/**
 * OpenClaw WebSocket integration for real-time messaging.
 * Connects to OpenClaw Gateway WebSocket, manages reconnection,
 * offline queue, and message history.
 */
(function () {
  'use strict';

  class OpenClawWebSocket {
    constructor(options = {}) {
      this.wsUrl = options.wsUrl || 'ws://localhost:8080';
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
      this.reconnectDelay = options.reconnectDelay || 1000; // ms
      this.maxReconnectDelay = options.maxReconnectDelay || 30000;
      this.heartbeatInterval = options.heartbeatInterval || 30000;
      this.heartbeatTimeout = options.heartbeatTimeout || 5000;

      this.socket = null;
      this.isConnected = false;
      this.isConnecting = false;
      this.messageQueue = []; // outgoing messages while offline
      this.listeners = {
        open: [],
        close: [],
        message: [],
        error: [],
        reconnect: [],
        statusChange: [],
      };

      this.storageKey = 'openclaw_chat_history';
      this.queueKey = 'openclaw_message_queue';
      this._loadQueue();
      this._loadHistory();

      this.heartbeatTimer = null;
      this.reconnectTimer = null;
      this.backoffFactor = 1.5;
    }

    // ==================== Public API ====================

    /**
     * Connect to WebSocket server.
     */
    connect() {
      if (this.isConnecting || this.isConnected) {
        console.warn('OpenClawWebSocket: Already connecting or connected');
        return;
      }
      this.isConnecting = true;
      this._updateStatus('connecting');

      try {
        this.socket = new WebSocket(this.wsUrl);
        this.socket.addEventListener('open', this._handleOpen.bind(this));
        this.socket.addEventListener('close', this._handleClose.bind(this));
        this.socket.addEventListener('message', this._handleMessage.bind(this));
        this.socket.addEventListener('error', this._handleError.bind(this));
      } catch (err) {
        console.error('OpenClawWebSocket: Failed to create WebSocket', err);
        this._scheduleReconnect();
      }
    }

    /**
     * Disconnect from WebSocket server.
     */
    disconnect() {
      this._clearTimers();
      if (this.socket) {
        this.socket.close(1000, 'User initiated disconnect');
        this.socket = null;
      }
      this.isConnected = false;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this._updateStatus('disconnected');
    }

    /**
     * Send a message. If offline, message is queued.
     * @param {Object|string} data - Message data (will be JSON.stringify if object)
     * @param {string} type - Optional message type (default 'message')
     */
    sendMessage(data, type = 'message') {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      const message = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        type,
        payload,
        timestamp: Date.now(),
        status: 'pending',
      };

      if (this.isConnected) {
        this._sendRaw(message);
      } else {
        this._enqueue(message);
        this._updateStatus('offline');
      }
    }

    /**
     * Get message history (from localStorage).
     * @param {number} limit - Maximum number of messages to return
     * @returns {Array} Message objects sorted by timestamp ascending
     */
    getHistory(limit = 100) {
      return this.history.slice(-limit);
    }

    /**
     * Clear message history (localStorage).
     */
    clearHistory() {
      this.history = [];
      localStorage.removeItem(this.storageKey);
      this._emit('message', { type: 'history_cleared' });
    }

    /**
     * Add event listener.
     * @param {string} event - 'open', 'close', 'message', 'error', 'reconnect', 'statusChange'
     * @param {Function} callback
     */
    on(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event].push(callback);
      } else {
        console.warn(`OpenClawWebSocket: Unknown event ${event}`);
      }
    }

    /**
     * Remove event listener.
     */
    off(event, callback) {
      if (this.listeners[event]) {
        const idx = this.listeners[event].indexOf(callback);
        if (idx >= 0) this.listeners[event].splice(idx, 1);
      }
    }

    /**
     * Get current connection status.
     * @returns {string} 'disconnected', 'connecting', 'connected', 'offline'
     */
    getStatus() {
      if (this.isConnected) return 'connected';
      if (this.isConnecting) return 'connecting';
      return this.messageQueue.length > 0 ? 'offline' : 'disconnected';
    }

    // ==================== Internal Methods ====================

    _handleOpen(event) {
      console.log('OpenClawWebSocket: Connected to', this.wsUrl);
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this._updateStatus('connected');
      this._startHeartbeat();
      this._flushQueue();
      this._emit('open', event);
    }

    _handleClose(event) {
      console.log('OpenClawWebSocket: Disconnected', event.code, event.reason);
      this.isConnected = false;
      this.isConnecting = false;
      this._clearTimers();
      this._updateStatus('disconnected');
      this._emit('close', event);

      // Attempt reconnect if not normal closure
      if (event.code !== 1000 && event.code !== 1005) {
        this._scheduleReconnect();
      }
    }

    _handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        this._storeInHistory(data);
        this._emit('message', data);

        // Reset heartbeat on any incoming message
        this._resetHeartbeat();
      } catch (err) {
        console.warn('OpenClawWebSocket: Received non-JSON message', event.data);
        this._emit('message', { raw: event.data });
      }
    }

    _handleError(event) {
      console.error('OpenClawWebSocket: Error', event);
      this._emit('error', event);
      // Close event will follow, which triggers reconnect
    }

    _sendRaw(message) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify(message));
          message.status = 'sent';
          message.sentAt = Date.now();
          this._storeInHistory(message);
        } catch (err) {
          console.error('OpenClawWebSocket: Send error', err);
          message.status = 'error';
          this._enqueue(message); // requeue
        }
      } else {
        this._enqueue(message);
      }
    }

    _enqueue(message) {
      this.messageQueue.push(message);
      localStorage.setItem(this.queueKey, JSON.stringify(this.messageQueue));
      this._updateStatus('offline');
    }

    _flushQueue() {
      if (this.messageQueue.length === 0) return;
      console.log(`OpenClawWebSocket: Flushing ${this.messageQueue.length} queued messages`);
      const queue = [...this.messageQueue];
      this.messageQueue = [];
      localStorage.removeItem(this.queueKey);
      queue.forEach((msg) => this._sendRaw(msg));
    }

    _loadQueue() {
      try {
        const stored = localStorage.getItem(this.queueKey);
        this.messageQueue = stored ? JSON.parse(stored) : [];
      } catch (err) {
        console.error('OpenClawWebSocket: Failed to load queue', err);
        this.messageQueue = [];
      }
    }

    _loadHistory() {
      try {
        const stored = localStorage.getItem(this.storageKey);
        this.history = stored ? JSON.parse(stored) : [];
      } catch (err) {
        console.error('OpenClawWebSocket: Failed to load history', err);
        this.history = [];
      }
    }

    _storeInHistory(message) {
      // Avoid duplicates by ID
      const existingIdx = this.history.findIndex((m) => m.id === message.id);
      if (existingIdx >= 0) {
        this.history[existingIdx] = message;
      } else {
        this.history.push(message);
      }
      // Keep last 1000 messages
      if (this.history.length > 1000) {
        this.history = this.history.slice(-1000);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    }

    _scheduleReconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('OpenClawWebSocket: Max reconnect attempts reached');
        this._updateStatus('failed');
        return;
      }

      const delay = Math.min(
        this.reconnectDelay * Math.pow(this.backoffFactor, this.reconnectAttempts),
        this.maxReconnectDelay
      );

      console.log(
        `OpenClawWebSocket: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`
      );
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);

      this._emit('reconnect', { attempt: this.reconnectAttempts, delay });
    }

    _startHeartbeat() {
      if (this.heartbeatInterval <= 0) return;
      this._resetHeartbeat();
    }

    _resetHeartbeat() {
      if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = setTimeout(() => {
        this._sendHeartbeat();
      }, this.heartbeatInterval);
    }

    _sendHeartbeat() {
      if (this.isConnected) {
        this.sendMessage({ type: 'heartbeat' }, 'heartbeat');
        // Expect a heartbeat reply within timeout
        const timeout = setTimeout(() => {
          console.warn('OpenClawWebSocket: Heartbeat timeout');
          this.socket.close(1000, 'Heartbeat timeout');
        }, this.heartbeatTimeout);
        // Clear timeout on next message
        const clear = () => {
          clearTimeout(timeout);
          this.socket.removeEventListener('message', clear);
        };
        this.socket.addEventListener('message', clear);
      }
    }

    _clearTimers() {
      if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.heartbeatTimer = null;
      this.reconnectTimer = null;
    }

    _updateStatus(status) {
      const prev = this.getStatus();
      this._emit('statusChange', { previous: prev, current: status });
    }

    _emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach((cb) => {
          try {
            cb(data);
          } catch (err) {
            console.error(`OpenClawWebSocket: Error in ${event} listener`, err);
          }
        });
      }
    }
  }

  // Expose globally
  window.OpenClawWebSocket = OpenClawWebSocket;
})();
