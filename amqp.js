'use strict';

const amqp = require('amqplib');
const EventEmitter = require('events').EventEmitter;
const bluebirdRetry = require('bluebird-retry');

/**
 * The AMQP class. Allows you to connect to, listen from, and publish to an AMQP queue.
 *
 * @fires AMQP#connect - When the connection to AMQP connected.
 * @fires AMQP#message - When a message is received in the queue.
 * @fires AMQP#listen - When the instance starts listening to messages in the queue.
 * @fires AMQP#error - When something goes wrong.
 * @fires AMQP#close - When the connection to AMQP is closed.
 */
class AMQP extends EventEmitter {

    /**
     * Constructor of the AMQP listener.
     *
     * @param {object} options - Options object.
     * @param {string} options.host - The AMQP host to connect to.
     * @param {string} options.username - The AMQP username.
     * @param {string} options.password - The AMQP password.
     * @param {function} options.logger - A `bunyan` logger instance.
     * @param {object} options.retry - Retry settings.
     * @param {number} options.retry.maxTries - Amount of retries.
     * @param {number} options.retry.interval - Interval between retries.
     * @param {number} options.retry.backoff - Backoff factor.
     * @param {boolean} options.durable - Whether to use durable queues or not.
     */
    constructor({ host, username, password, logger, retry, durable = false }) {
        super();
        this.host = host;
        this.username = username;
        this.password = password;
        this.logger = logger;
        this.retry = retry;
        this.durable = durable;
    }

    /**
     * Start the fun.
     */
    start() {
        this.connect();
    }

    /**
     * Connect to AMQP.
     */
    connect() {
        const { logger, retry, host, username, password } = this;
        const URL = `amqp://${username}:${password}@${host}`;
        bluebirdRetry(() => {
            // Initial connection to AMQP will be retried, settings thereof are configurable
            logger.info({ host, username }, 'Connecting to AMQP...');
            return amqp.connect(URL).tapCatch((err) => {
                logger.error({ err }, 'Something went wrong while connecting to AMQP. Retrying...');
            });
        }, {
            max_tries: retry.maxTries, // eslint-disable-line camelcase
            interval: retry.interval,
            backoff: retry.backoff
        }).then(conn => {
            this.conn = conn;
            /**
             * Event fired when the connection to AMQP is successful.
             *
             * @event AMQP#connect
             * @type {object}
             */
            this.emit('connect', conn);
        });
    }

    /**
     * Gets the channel for this instance, or create a new one if it doesn't exist yet.
     *
     * @returns {Promise} A promise to a AMQP channel.
     */
    getChannel() {
        const { channel } = this;
        if (!channel) {
            return this.createChannel();
        }
        return Promise.resolve(channel);
    }

    /**
     * Creates a new channel and handles all possible disconnections.
     *
     * @returns {Promise} A promise to a AMQP channel.
     */
    createChannel() {
        const { logger, conn } = this;
        if (!conn) {
            return Promise.reject(new Error('No connection'));
        }
        return conn.createChannel().then(channel => {
            channel.on('error', err => {
                logger.error({ err }, 'Error in AMQP channel');
                this.createChannel();
            });
            channel.on('close', () => {
                logger.warn('Channel was closed');
                this.createChannel();
            });
            this.channel = channel;
            return this.channel;
        });
    }

    /**
     * Listen to a queue.
     *
     * @param {string} queue - Name of the queue to listen to.
     */
    listen(queue) {
        const { logger, host, durable } = this;
        this.getChannel().then(channel => {
            let ok = channel.assertQueue(queue, { durable });
            ok = ok.then(() => {
                // Start consuming the queue, waiting for messages
                return channel.consume(queue, data => {
                    logger.trace({ fields: data.fields }, 'Received data from queue');
                    const message = data.content.toString();
                    logger.info({ message }, 'Received message from queue');
                    /**
                     * Event fired when a message is received in the queue.
                     *
                     * @event AMQP#message
                     */
                    this.emit('message', message);
                }, { noAck: true });
            });
            return ok.then(() => {
                logger.info({ queue, host }, 'Listening to messages');
                /**
                 * Event fired when the instance starts listening to messages in the queue.
                 *
                 * @event AMQP#listen
                 */
                this.emit('listen');
            });
        }).catch(err => {
            logger.error({ err }, 'Something went wrong');
            /**
             * Event fired when an error occurs.
             *
             * @event AMQP#error
             * @type {object}
             */
            this.emit('error', err);
        });
    }

    /**
     * Publish a message.
     *
     * @param {string} queue - Queue to publish the message to.
     * @param {string} message - The message to publish.
     */
    publish(queue, message) {
        const { logger } = this;
        this.getChannel().then(channel => {
            let ok = channel.assertQueue(queue, { durable: this.durable });
            return ok.then(() => {
                logger.info({ message, queue }, 'Publishing message');
                channel.sendToQueue(queue, Buffer.from(message));
            });
        }).catch(err => {
            logger.error({ err }, 'Something went wrong');
            this.emit('error', err);
        });
    }

    /**
     * Stop the AMQP listener. Connection with AMQP, if present, will be closed.
     */
    stop() {
        const { logger, conn, channel } = this;
        if (!conn) {
            logger.warn('There is no open connection');
            return;
        }
        if (channel) {
            logger.info('Closing channel...');
            channel.removeAllListeners();
            channel.close();
            logger.info('Channel closed');
            this.channel = undefined;
        }
        logger.info('Closing connection...');
        conn.close();
        logger.info('Connection closed');
        this.conn = undefined;
        /**
         * Event fired when the connection to AMQP is closed.
         *
         * @event AMQP#close
         */
        this.emit('close');
    }
}

module.exports = AMQP;
