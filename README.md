# Quargo

A mix of [async](https://github.com/caolan/async)’s [`queue`](https://github.com/caolan/async#queue) and [`cargo`](https://github.com/caolan/async#cargo), with capacity optimization.


Structure | Tasks per worker (_capacity_) | Workers per structure (_concurrency_)
---|:---:|:---:
__queue__|1|`x`
__cargo__|`y`|1
__quargo__|`y`|`x`

```js
var queue = async.queue(worker, concurrency);
var cargo = async.cargo(function(tasks, callback) {
    queue.push(tasks);
    callback();
}, capacity);

cargo.push('a task')
```

---

### quargo(worker, [capacity, [concurrency, [delay]]])

Creates a `quargo` object with the specified `capacity`, `concurrency` and `delay`. Tasks added to the `quargo` will be processed altogether (up to the `capacity` limit) in parallel batches (up to the `concurrency` limit). If all workers are in progress, the task is queued until one becomes available. If the `quargo` hasn’t reached `capacity`, the task is queued for maximum `delay`. Once a worker has completed some tasks, each callback of those tasks is called.

Quargo passes an array of tasks to one of a group of workers, repeating when the worker is finished.

##### Arguments

- `worker(tasks, callback)` - An asynchronous function for processing an array of queued tasks, which must call its `callback(err)` argument when finished, with an optional `err` argument.
- `capacity` - An optional integer for determining how many tasks should be processed per round; if omitted, the default is unlimited.
- `concurrency` - An optional integer for determining how many worker functions should be run in parallel; if omitted, the default is `1`.
- `delay` - An optional integer for determining how long should the `quargo` wait to reach `capacity`; if omitted, the default is `0`.

##### Quargo objects

The `quargo` object returned has the following properties and methods:

- `length()` - a function returning the number of items waiting to be processed.
