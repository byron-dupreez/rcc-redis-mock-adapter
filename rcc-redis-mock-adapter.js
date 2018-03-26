'use strict';

const rccCore = require('rcc-core');

const redis = require('redis-mock');
const ReplyError = require('redis').ReplyError;
exports.ReplyError = ReplyError;

const adaptee = 'redis-mock';
exports.adaptee = adaptee;

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

function fixRedisClientFunctions() {
  const prototype = redis.RedisClient.prototype;

  if (!prototype._ping) {
    prototype._ping = prototype.ping; // backup original `ping` method
    console.log('Fixed `ping` function on `redis-mock` client prototype');
    prototype.ping = pingFix;
  }

  // If client is missing a `ping` method then add a dummy one
  if (!prototype.info) {
    console.log('Added dummy implementation for missing `info` function to `redis-mock` client prototype');
    prototype.info = createDummyFn('info');
  }

  // If client is missing an `exec` method then add a dummy one
  if (!prototype.exec) {
    console.log('Added dummy implementation for missing `exec` function to `redis-mock` client prototype');
    prototype.exec = createDummyFn('exec');
  }

  if (!prototype._end) {
    prototype._end = prototype.end; // backup original `end` method
    console.log('Extended `end` function on `redis-mock` client prototype via `endAndMarkAsClosing` function');
    prototype.end = endAndMarkAsClosing;
  }
}

function adaptRedisClient() {
  const prototype = redis.RedisClient.prototype;

  if (!prototype.getAdapter) {
    prototype.getAdapter = getAdapter;
  }

  if (!prototype.getOptions) {
    prototype.getOptions = getOptions;
  }

  if (!prototype.isClosing) {
    prototype.isClosing = isClosing;
  }

  if (!prototype.resolveHostAndPort) {
    prototype.resolveHostAndPort = resolveHostAndPort;
  }

  if (!prototype.addEventListeners) {
    prototype.addEventListeners = addEventListeners;
  }

  if (!prototype.getFunction) {
    prototype.getFunction = getClientFunction;
  }

  if (!prototype.setFunction) {
    prototype.setFunction = setClientFunction;
  }

  if (!prototype.deleteFunction) {
    prototype.deleteFunction = deleteClientFunction;
  }
}

fixRedisClientFunctions();
adaptRedisClient();

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
  return client;
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

function pingFix() {
  const arg0 = arguments[0];
  let result;
  if (typeof arg0 === 'function') {
    // Since first argument is a function, assume its the callback
    result = this._ping.apply(this, arguments);
  } else {
    // Since first argument is NOT a function, assume its meant to be the "pong" response to bounce back and drop it
    const n = arguments.length;
    let args = new Array(n - 1);
    for (let i = 1; i < n; ++i) {
      args[i - 1] = arguments[i];
    }
    // Call original ping without the pong response first argument to avoid it breaking
    result = this._ping.apply(this, args);
  }
  return result;
}

function createDummyFn(fnName) {

  function dummyFn() {
    console.log(`Simulating dummy '${fnName}' function on the redis-mock client prototype`);
    const n = arguments.length;
    const callback = n > 0 ? arguments[n - 1] : undefined;
    if (typeof callback === 'function') {
      callback(null, undefined);
    }
  }

  return dummyFn;
}

function endAndMarkAsClosing(flush) {
  const result = this._end.apply(this, arguments);
  this.manuallyClosing = true; // simulate a "closing" flag
  return result;
}

/**
 * Returns true if this RedisClient instance's connection is closing or has closed.
 * @return {boolean} true if closing or closed; false otherwise
 */
function getAdapter() {
  return module.exports;
}

/**
 * Returns the options with which this RedisClient instance was constructed.
 * @returns {RedisClientOptions} the options used
 */
function getOptions() {
  return this._options;
}

/**
 * Returns true if this RedisClient instance's connection is closing or has closed.
 * @return {boolean} true if closing or closed; false otherwise
 */
function isClosing() {
  return this.manuallyClosing;
}

/**
 * Resolves the host & port of this RedisClient instance.
 * @return {[string, number|string]} an array containing the host and port
 */
function resolveHostAndPort() {
  return this._options ? [this._options.host || defaultHost, this._options.port || defaultPort] :
    [defaultHost, defaultPort];
}

function addEventListeners(onConnect, onReady, onReconnecting, onError, onClientError, onEnd, onClose) {
  if (typeof onConnect === 'function') this.on('connect', onConnect);
  if (typeof onReady === 'function') this.on('ready', onReady);
  if (typeof onReconnecting === 'function') this.on('reconnecting', onReconnecting);
  if (typeof onError === 'function') this.on('error', onError);
  if (typeof onClientError === 'function') this.on('clientError', onClientError);
  if (typeof onEnd === 'function') this.on('end', onEnd);
  if (typeof onClose === 'function') this.on('close', onClose);
}