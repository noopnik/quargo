# Quargo

A mix of [async](https://github.com/caolan/async)’s [`queue`](https://github.com/caolan/async#queue) and [`cargo`](https://github.com/caolan/async#cargo) with capacity optimization.

[![NPM](https://nodei.co/npm/quargo.png)](https://nodei.co/npm/quargo/)

---

### quargo(worker, [capacity, [concurrency, [delay]]])

Creates a `quargo` object with the specified `capacity`, `concurrency` and `delay`. Tasks added to the `quargo` will be processed altogether (up to the `capacity` limit) in parallel batches (up to the `concurrency` limit). If all workers are in progress, the task is queued until one becomes available. If the `quargo` hasn’t reached `capacity`, the task is queued for `delay` milliseconds. Once a worker has completed some tasks, each callback of those tasks is called.

Quargo passes an array of tasks to one of a group of workers, repeating when the worker is finished.

##### Rules to process tasks

- A worker processes a maximum of `capacity` tasks at once.
- A task is processed at most `delay` milliseconds after being pushed to the `quargo`
- Tasks are processed __as soon as__ `capacity` is reached __or__ `delay` has passed, _depending on workers availability_.

##### Arguments

- `worker(tasks, callback)` - An asynchronous function for processing an array of queued tasks, which must call its `callback(err)` argument when finished, with an optional `err` argument.
- `capacity` - An optional integer for determining how many tasks should be processed per round; if omitted, the default is unlimited.
- `concurrency` - An optional integer for determining how many worker functions should be run in parallel; if omitted, the default is `1`.
- `delay` - An optional integer for determining how long should the `quargo` wait to reach `capacity`; if omitted, the default is `0`.

##### Quargo objects

The `quargo` object returned has the following properties and methods:

- `length()` - a function returning the number of items waiting to be processed.

---

### Compared to Async

Object | Tasks per worker (_capacity_) | Workers per object (_concurrency_)
---|:---:|:---:
__queue__|1|`x`
__cargo__|`y`|1
__quargo__|`y`|`x`

#### `quargo(worker, capacity)`

Equivalent to `async.cargo(worker, capacity)`

#### `quargo(worker, 1, concurrency)`

Equivalent to `async.queue(worker, concurrency)`

#### `quargo(worker, capacity, concurrency)`

Roughly equivalent to using a queue and a cargo together
```js
var queue = async.queue(worker, concurrency);

var cargo = async.cargo(function(tasks, cargoCb) {
  queue.push(tasks);
  cargoCb(); // call immediately
}, capacity);

cargo.push(task, taskCb);
```

In the `async` version, `taskCb` will never be called (it would mean passing `cargoCb` to `queue.push(tasks, cargoCb)`, which therefore waits for the worker to complete before pushing other tasks to the queue, making the queue useless).

#### `quargo(worker, capacity, concurrency, delay)`

Instead of processing tasks on next tick as `async.cargo` does, `quargo` waits for `delay` milliseconds before processing tasks.
If `capacity` is reached before `delay`, `delay` is ignored and tasks are processed immediately. This is the __capacity optimization__ of `quargo`.

---

### Use Case examples

#### Analytics, Statistics
You may send a huge amount of data to [StatHat](https://www.stathat.com). Do you make an HTTP request every-time, when you could send them by batch instead? `async.cargo` won’t help though, I doubt all stats arrive during the same _tick_.

#### Rate-Limits
You send data to [BigQuery](https://developers.google.com/bigquery/) but the rate at which you would like to send it exceeds their limit? You need a `quargo` in your life to send by batches instead.

#### Paying APIs (AWS)
[AWS SQS](http://aws.amazon.com/sqs/) is super cheap. Using a `quargo` to delete messages by batch makes it cheaper.
