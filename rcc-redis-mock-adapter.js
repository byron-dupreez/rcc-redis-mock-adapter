'use strict';

const rccCore = require('rcc-core');

const redis = require('redis-mock');

const defaultHost = '127.0.0.1';
const defaultPort = rccCore.DEFAULT_REDIS_PORT;

exports.defaultHost = defaultHost;
exports.defaultPort = defaultPort;

exports.createClient = createClient;

exports.getClientFunction = getClientFunction;
exports.setClientFunction = setClientFunction;
exports.deleteClientFunction = deleteClientFunction;

exports.isMovedError = isMovedError;
exports.resolveHostAndPortFromMovedError = resolveHostAndPortFromMovedError;

/**
 * Creates a new RedisClient instance.
 * @param {RedisClientOptions|undefined} [redisClientOptions] - the options to use to construct the new RedisClient
 *        instance
 * @return {RedisClient} returns the new RedisClient instance
 */
function createClient(redisClientOptions) {
  const client = redis.createClient(redisClientOptions);
  if (!client._options) {
    client._options = redisClientOptions;
  }
  adaptClient(client);
  return client;
}

function adaptClient(client) {
  if (!client._ping) {
    client._ping = client.ping; // backup original `ping` method
    client.ping = function ping() {
      const arg0 = arguments[0];
      let result;
      if (typeof arg0 === 'function') {
        // Since first argument is a function, assume its the callback
        result = this._ping.apply(this, arguments);
      } else {
        // Since first argument is NOT a function, assume its meant to be the "pong" response to bounce back
        const n = arguments.length - 1;
        let args = new Array(n);
        for (let i = 1; i < n; ++i) {
          args[i - 1] = arguments[i];
        }
        result = this._ping.apply(this, args);
      }
      return result;
    };
  }

  if (!client._end) {
    client._end = client.end; // backup original `end` method
    client.end = function end(flush) {
      const result = this._end.apply(this, arguments);
      this.manuallyClosing = true; // simulate a "closing" flag
      return result;
    };
  }

  if (!client.getAdapter) {
    /**
     * Returns true if this RedisClient instance's connection is closing or has closed.
     * @return {boolean} true if closing or closed; false otherwise
     */
    client.getAdapter = function () {
      return module.exports;
    };
  }

  if (!client.isClosing) {
    /**
     * Returns true if this RedisClient instance's connection is closing or has closed.
     * @return {boolean} true if closing or closed; false otherwise
     */
    client.isClosing = function () {
      return this.manuallyClosing;
    };
  }

  if (!client.resolveHostAndPort) {
    /**
     * Resolves the host & port of this RedisClient instance.
     * @return {[string, string|number]} an array containing the host and port
     */
    client.resolveHostAndPort = function () {
      return this._options ? [this._options.host || defaultHost, this._options.port || defaultPort] :
        [defaultHost, defaultPort];
    };
  }

  if (!client.getOptions) {
    client.getOptions = function () {
      return this._options;
    };
  }

  if (!client.addEventListeners) {
    client.addEventListeners = function (onConnect, onReady, onReconnecting, onError, onClientError, onEnd, onClose) {
      if (typeof onConnect === 'function') this.on('connect', onConnect);
      if (typeof onReady === 'function') this.on('ready', onReady);
      if (typeof onReconnecting === 'function') this.on('reconnecting', onReconnecting);
      if (typeof onError === 'function') this.on('error', onError);
      if (typeof onClientError === 'function') this.on('clientError', onClientError);
      if (typeof onEnd === 'function') this.on('end', onEnd);
      if (typeof onClose === 'function') this.on('close', onClose);
    }
  }

  if (!client.getFunction) {
    client.getFunction = getClientFunction;
  }

  if (!client.setFunction) {
    client.setFunction = setClientFunction;
  }

  if (!client.deleteFunction) {
    client.deleteFunction = deleteClientFunction;
  }
}

function getClientFunction(fnName) {
  return redis.RedisClient.prototype[fnName];
}

function setClientFunction(fnName, fn) {
  redis.RedisClient.prototype[fnName] = fn;
}

function deleteClientFunction(fnName) {
  delete redis.RedisClient.prototype[fnName];
}

/**
 * Returns true if the given error indicates that the key attempted was moved to a new host and port; otherwise returns
 * false.
 * @param {Error|ReplyError} error - an error thrown by a RedisClient instance
 * @return {boolean} true if moved; false otherwise
 */
function isMovedError(error) {
  // Check if error message contains something like: "MOVED 14190 127.0.0.1:6379"
  return error.code === 'MOVED' || (error.message && error.message.startsWith('MOVED '));
}

/**
 * Extracts the new host and port from the given RedisClient "moved" ReplyError.
 * @param {ReplyError|Error} movedError - a ReplyError thrown by a RedisClient instance that indicates the redis server
 *        has moved
 * @return {[string, number|string]} the new host and port
 */
function resolveHostAndPortFromMovedError(movedError) {
  // Attempt to resolve the new host & port from the error message
  if (isMovedError(movedError)) {
    return movedError.message.substring(movedError.message.lastIndexOf(' ') + 1).split(':');
  }
  throw new Error(`Unexpected redis mock client "moved" ReplyError - ${movedError}`);
}