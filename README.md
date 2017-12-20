# AMQPimping

AMQPimping is a simple wrapper around the `amqplib` module. You can use it,
for example, to listen and publish messages to RabbitMQ.

## Features

* Event-emitting class
* Reuse AMQP connection and channel
* Reconnect to queue / channel on disconnections and errors
* Retry mechanism with on `bluebird-retry`
* `bunyan` integration

## Example usage

```javascript

class Queue extends AMQP {

    constructor({ logger }) {
        super({
            host: 'localhost',
            username: 'someUsername',
            password: 'somePassword',
            logger: bunyan.createLogger({ name: 'queue' }),
            retry: {
                maxTries: 10,
                interval: 1000,
                backoff: 2
            }
        });
    }
}

const queue = new Queue({ logger });

// Make sure you listen to any event before doing queue.start()!

queue.on('connect', () => {
    // Once connected, we can start listening to queues
    queue.listen('some_queue');
});

queue.on('listen', () => {
    console.log('Goodnight Seattle, I\'m listening');

    queue.publish('a_different_queue', 'How can I help you?');

    queue.stop();
});

// Start the queue
queue.start();

```

<a name="AMQP"></a>

## API

* [AMQP](#AMQP)
    * [new AMQP(options)](#new_AMQP_new)
    * [.start()](#AMQP+start)
    * [.connect()](#AMQP+connect)
    * [.getChannel()](#AMQP+getChannel) ⇒ <code>Promise</code>
    * [.createChannel()](#AMQP+createChannel) ⇒ <code>Promise</code>
    * [.listen(queue)](#AMQP+listen)
    * [.publish(queue, message)](#AMQP+publish)
    * [.stop()](#AMQP+stop)
* Events
    * ["connect"](#AMQP+event_connect) - When the connection to AMQP is established.
    * ["message"](#AMQP+event_message) -  When a message is received in the queue.
    * ["listen"](#AMQP+event_listen) - When the instance starts listening to messages in the queue.
    * ["error"](#AMQP+event_error) - When something goes wrong.
    * ["close"](#AMQP+event_close) - When the connection to AMQP is closed.

<a name="new_AMQP_new"></a>

### new AMQP(options)
Constructor of the AMQP listener.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>object</code> | Options object. |
| options.host | <code>string</code> | The AMQP host to connect to. |
| options.username | <code>string</code> | The AMQP username. |
| options.password | <code>string</code> | The AMQP password. |
| options.logger | <code>function</code> | A `bunyan` logger instance. |
| options.retry | <code>object</code> | Retry settings. |
| options.retry.maxTries | <code>number</code> | Amount of retries. |
| options.retry.interval | <code>number</code> | Interval between retries. |
| options.retry.backoff | <code>number</code> | Backoff factor. |
| options.durable | <code>boolean</code> | Whether to use durable queues or not. |

<a name="AMQP+start"></a>

### amqp.start()
Start the fun.

**Kind**: instance method of [<code>AMQP</code>](#AMQP)
<a name="AMQP+connect"></a>

### amqp.connect()
Connect to AMQP.

**Kind**: instance method of [<code>AMQP</code>](#AMQP)
<a name="AMQP+getChannel"></a>

### amqp.getChannel() ⇒ <code>Promise</code>
Gets the channel for this instance, or create a new one if it doesn't exist yet.

**Kind**: instance method of [<code>AMQP</code>](#AMQP)
**Returns**: <code>Promise</code> - A promise to a AMQP channel.
<a name="AMQP+createChannel"></a>

### amqp.createChannel() ⇒ <code>Promise</code>
Creates a new channel and handles all possible disconnections.

**Kind**: instance method of [<code>AMQP</code>](#AMQP)
**Returns**: <code>Promise</code> - A promise to a AMQP channel.
<a name="AMQP+listen"></a>

### amqp.listen(queue)
Listen to a queue.

**Kind**: instance method of [<code>AMQP</code>](#AMQP)

| Param | Type | Description |
| --- | --- | --- |
| queue | <code>string</code> | Name of the queue to listen to. |

<a name="AMQP+publish"></a>

### amqp.publish(queue, message)
Publish a message.

**Kind**: instance method of [<code>AMQP</code>](#AMQP)

| Param | Type | Description |
| --- | --- | --- |
| queue | <code>string</code> | Queue to publish the message to. |
| message | <code>string</code> | The message to publish. |

<a name="AMQP+stop"></a>

### amqp.stop()
Stop the AMQP listener. Connection with AMQP, if present, will be closed.

**Kind**: instance method of [<code>AMQP</code>](#AMQP)
<a name="AMQP+event_connect"></a>

### "connect"
Event fired when the connection to AMQP is successful.

**Kind**: event emitted by [<code>AMQP</code>](#AMQP)
<a name="AMQP+event_message"></a>

### "message"
Event fired when a message is received in the queue.

**Kind**: event emitted by [<code>AMQP</code>](#AMQP)
<a name="AMQP+event_listen"></a>

### "listen"
Event fired when the instance starts listening to messages in the queue.

**Kind**: event emitted by [<code>AMQP</code>](#AMQP)
<a name="AMQP+event_error"></a>

### "error"
Event fired when an error occurs.

**Kind**: event emitted by [<code>AMQP</code>](#AMQP)
<a name="AMQP+event_close"></a>

### "close"
Event fired when the connection to AMQP is closed.

**Kind**: event emitted by [<code>AMQP</code>](#AMQP)

## Testing

Run the integration tests with `npm test`. You'll need docker compose to be installed.

## License

See [LICENSE](LICENSE).