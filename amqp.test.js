'use strict';

/* global describe, it, before, after, beforeEach, afterEach */

const compose = require('docker-compose');
const { expect } = require('chai');
const sinon = require('sinon');
const { Spinner } = require('cli-spinner');

const AMQP = require('./amqp');

// Mocked bunyan logger
const logger = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].reduce((accumulator, item) => {
    accumulator[item] = function(message) {
        // Do nothing
    };
    return accumulator;
}, {});

describe('AMQP', () => {

    const sandbox = sinon.createSandbox();

    // Start the docker-compose for tests
    before(async function() {
        this.timeout(0);
        const spinner = new Spinner('Invoking docker-compose... %s');
        spinner.setSpinnerString(0);
        spinner.start();
        await compose.up({ cwd: __dirname, log: false });
        spinner.stop(true);
    });

    // Close the HTTP server and the queues, otherwise the process won't ever end; optionally stop docker-compose
    after(async function () {
        this.timeout(0);
        const spinner = new Spinner('Shutting down services... %s');
        spinner.setSpinnerString(0);
        spinner.start();
        await compose.down({ cwd: __dirname, log: false });
        spinner.stop(true);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Starting up and shutting down the queue', () => {

        class SimpleQueue extends AMQP {

            constructor({ logger }) {
                super({
                    host: 'localhost',
                    username: 'amqpimping',
                    password: 'amqpimping',
                    logger,
                    retry: {
                        maxTries: 10,
                        interval: 1000,
                        backoff: 2
                    }
                });
            }
        }

        const queue = new SimpleQueue({ logger });

        it('Retries connection to the AMQP server because it\'s not ready yet', function (done) {
            this.timeout(0);
            const spy = sandbox.spy(queue, 'connect');
            queue.once('connect', conn => {
                expect(spy.callCount).to.be.eql(1);
                expect(conn).to.exist.and.be.an('object');
                expect(queue.conn).to.exist.and.be.an('object');
                done();
            });
            queue.once('error', err => {
                done(err);
            });
            queue.start();
        });

        it('Closes an open connection to AMQP', done => {
            queue.once('close', () => {
                expect(queue.conn).to.be.undefined;
                done();
            });
            queue.stop();
        });

        it('Doesn\'t allow to close a queue that\'s already closed', done => {
            queue.once('close', () => {
                done(new Error('This queue should not emit the event "close"'));
            });
            queue.stop();
            setTimeout(done, 1000);
        });
    });

    describe('Listening and publishing', () => {

        const QUEUE_NAME = 'test-queue';

        class Queue extends AMQP {

            constructor({ logger }) {
                super({
                    host: 'localhost',
                    username: 'amqpimping',
                    password: 'amqpimping',
                    logger,
                    retry: {
                        maxTries: 10,
                        interval: 1000,
                        backoff: 2
                    }
                });
            }
        }

        const queue = new Queue({ logger });

        after(() => {
            queue.stop()
        });

        it('Connects and listens to a queue', function (done) {
            queue.once('connect', () => {
                queue.listen(QUEUE_NAME)
            });
            queue.once('listen', () => {
                done();
            });
            queue.start();
        });

        it('Publishes a message', function (done) {
            queue.once('message', message => {
                expect(message).to.be.eql('hello world');
                done();
            });
            queue.publish(QUEUE_NAME, 'hello world');
        });

        it('Publishes a lot of messages', function (done) {
            this.timeout(0);
            const amount = 1000;
            queue.on('message', message => {
                expect(message).to.be.a('string');
                if (message === `#${amount}`) {
                    queue.removeAllListeners();
                    done();
                }
            });
            for (let i = 0; i <= amount; i++) {
                queue.publish(QUEUE_NAME, `#${i}`);
            }
        });

        it('Publishes an error message', function (done) {
            queue.once('message', message => {
                expect(message).to.be.eql('something went wrong');
                done();
            });
            queue.publish(QUEUE_NAME, 'something went wrong');
        });

        it('Handles errors when listening to a queue', function (done) {
            sandbox.stub(queue, 'getChannel').rejects();
            queue.once('error', err => {
                expect(err).to.exist;
                done();
            });
            queue.listen('some-other-queue-name');
        });

        it('Handles errors when publishing a message', function (done) {
            sandbox.stub(queue, 'getChannel').rejects();
            queue.once('error', err => {
                expect(err).to.exist;
                done();
            });
            queue.publish(QUEUE_NAME, 'we expect this to break');
        });
    });
});
