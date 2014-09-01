var assert = require('assert');
var quargo = require('../lib/quargo');

describe('lib/quargo.js', function() {
  describe('initialization', function() {
    it('should set capacity only, default concurrency and delay', function(done) {
      var q = quargo(function() {}, 42);
      assert.deepEqual(q.capacity, 42);
      assert.deepEqual(q.concurrency, 1);
      assert.deepEqual(q.delay, 0);
      assert.strictEqual(q.empty, null);
      assert.strictEqual(q.drain, null);
      done();
    });

    it('should set capacity and concurrency, default delay', function(done) {
      var q = quargo(function() {}, 42, 43);
      assert.deepEqual(q.capacity, 42);
      assert.deepEqual(q.concurrency, 43);
      assert.deepEqual(q.delay, 0);
      assert.strictEqual(q.empty, null);
      assert.strictEqual(q.drain, null);
      done();
    });

    it('should set capacity, concurrency and delay', function(done) {
      var q = quargo(function() {}, 42, 43, 44);
      assert.deepEqual(q.capacity, 42);
      assert.deepEqual(q.concurrency, 43);
      assert.deepEqual(q.delay, 44);
      assert.strictEqual(q.empty, null);
      assert.strictEqual(q.drain, null);
      done();
    });

    it('should set capacity, concurrency, delay and optional callbacks', function(done) {
      var q = quargo(function() {}, 42, 43, 44);
      q.empty = 'empty cb';
      q.drain = 'drain cb';
      assert.deepEqual(q.capacity, 42);
      assert.deepEqual(q.concurrency, 43);
      assert.deepEqual(q.delay, 44);
      assert.strictEqual(q.empty, 'empty cb');
      assert.strictEqual(q.drain, 'drain cb');
      done();
    });

    it('should set worker and configuration', function(done) {
      var q = quargo(function() {}, {
        capacity: 42,
        concurrency: 43,
        delay: 44,
        empty: 'empty cb',
        drain: 'drain cb'
      });

      assert.deepEqual(q.capacity, 42);
      assert.deepEqual(q.concurrency, 43);
      assert.deepEqual(q.delay, 44);
      assert.strictEqual(q.empty, 'empty cb');
      assert.strictEqual(q.drain, 'drain cb');
      done();
    });

    it('should set configuration and worker', function(done) {
      var q = quargo({
        capacity: 42,
        concurrency: 43,
        delay: 44,
        empty: 'empty cb',
        drain: 'drain cb'
      }, function() {});

      assert.deepEqual(q.capacity, 42);
      assert.deepEqual(q.concurrency, 43);
      assert.deepEqual(q.delay, 44);
      assert.strictEqual(q.empty, 'empty cb');
      assert.strictEqual(q.drain, 'drain cb');
      done();
    });

    it('should set defaul values for missing configuration', function(done) {
      var q = quargo({}, function() {});

      assert.deepEqual(q.capacity, 1);
      assert.deepEqual(q.concurrency, 1);
      assert.deepEqual(q.delay, 0);
      assert.strictEqual(q.empty, null);
      assert.strictEqual(q.drain, null);
      done();
    });
  });

  describe('push', function() {
    it('should add a single task', function(done) {
      var processingTasks = [];
      var q = quargo({
        capacity: 10,
        delay: 500
      }, function(tasks) {
        processingTasks.push(tasks);
      });

      q.push('task');

      assert.deepEqual(q.length(), 1);
      done();
    });

    it('should add an array of tasks', function(done) {
      var processingTasks = [];
      var q = quargo({
        capacity: 10,
        delay: 500
      }, function(tasks) {
        processingTasks.push(tasks);
      });

      q.push(['task', 'task2', 'task3']);

      assert.deepEqual(q.length(), 3);
      done();
    });

    it('should allow no task callback', function(done) {
      var processedTasks = [];
      var q = quargo({
        capacity: 1
      }, function(tasks, callback) {
        callback();
        processedTasks.push(tasks);
      });

      q.push('task');

      setTimeout(function() {
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(processedTasks, [['task']]);
        done();
      }, 10);
    });

    it('should accept task callback', function(done) {
      var processedTasks = [];
      var q = quargo({
        capacity: 1
      }, function(tasks, callback) {
        callback();
        processedTasks.push(tasks);
      });

      q.push('task', function() {
        done();
      });
    });

    it('should call task callback for each task added', function(done) {
      var processedTasks = [];
      var q = quargo({
        capacity: 1
      }, function(tasks, callback) {
        processedTasks.push(tasks);
        callback();
      });

      var count = 0;
      q.push(['task', 'task2', 'task3'], function() {
        count++;
      });

      setTimeout(function() {
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(processedTasks, [['task'], ['task2'], ['task3']]);
        assert.deepEqual(count, 3);
        done();
      }, 10);
    });

    it('should add a timeout for every `capacity` batch', function(done) {
      var processedTasks = [];
      var q = quargo({
        capacity: 2,
        delay: 20
      }, function(tasks, callback) {
        processedTasks.push(tasks);
        callback();
      });

      assert.deepEqual(q.timeouts.length, 0);

      q.push('task');
      assert.deepEqual(q.timeouts.length, 1);

      q.push('task');
      assert.deepEqual(q.timeouts.length, 1);

      q.push('task');
      q.push('task');
      q.push('task');
      assert.deepEqual(q.timeouts.length, 3);

      q.push(['task', 'task', 'task']);
      assert.deepEqual(q.timeouts.length, 4);

      setTimeout(function() {
        assert.deepEqual(q.timeouts.length, 0);
        done();
      }, 30);
    });

    it('should call `mayProcess` on next tick', function(done) {
      var q = quargo({
        capacity: 2,
        delay: 20
      }, function() {});

      var count = 0;
      q.mayProcess = function() {
        count++;
      };

      q.push('task');
      assert.deepEqual(count, 0);

      setTimeout(function() {
        assert.deepEqual(count, 1);
        done();
      }, 1);
    });

    it('should return self', function(done) {
      var q = quargo({}, function() {});

      var qq = q.push('task');
      assert.strictEqual(qq, q);
      done();
    });
  });

  describe('shouldProcess', function() {
    it('should call `mayProcess` with `urgent` flag', function(done) {
      var q = quargo({}, function() {});
      q.mayProcess = function(urgentFlag) {
        assert.deepEqual(urgentFlag, true);
        done();
      };
      q.shouldProcess();
    });
  });

  describe('mayProcess', function() {
    it('should not trigger process if concurrency is reached', function(done) {
      var processingTasks = [];
      var q = quargo({
        concurrency: 2,
        capacity: 1
      }, function(tasks) {
        processingTasks.push(tasks);
      });

      q.push([1, 2]);

      setTimeout(function() {
        assert.deepEqual(processingTasks, [[1], [2]]);
        q.process = function() {
          assert.fail();
        };
        q.push(3);
        q.mayProcess();
        setTimeout(function() {
          done();
        }, 5);
      }, 5);
    });

    it('should not trigger process if capacity is not reached', function(done) {
      var processingTasks = [];
      var q = quargo({
        concurrency: 1,
        capacity: 5,
        delay: 100
      }, function(tasks) {
        processingTasks.push(tasks);
      });

      q.push([1, 2, 3, 4]);

      q.mayProcess();

      setTimeout(function() {
        assert.deepEqual(processingTasks, []);
        done();
      }, 5);
    });

    it('should trigger process if capacity is not reached but tasks are urgent', function(done) {
      var processingTasks = [];
      var q = quargo({
        concurrency: 1,
        capacity: 5,
        delay: 100
      }, function(tasks) {
        processingTasks.push(tasks);
      });

      q.push([1, 2, 3, 4]);

      q.mayProcess(true);

      setTimeout(function() {
        assert.deepEqual(processingTasks, [[1, 2, 3, 4]]);
        done();
      }, 5);
    });

    it('should trigger as much workers as possible', function(done) {
      var processingTasks = [];
      var q = quargo({
        concurrency: 3,
        capacity: 1,
        delay: 100
      }, function(tasks) {
        processingTasks.push(tasks);
      });

      q.push([1, 2]);

      q.mayProcess();

      assert.deepEqual(processingTasks, [[1], [2]]);
      done();
    });
  });

  describe('process', function() {
    it('should increment processing', function(done) {
      var q = quargo({}, function() {});
      q.mayProcess = function() {};

      assert.deepEqual(q.processing, 0);
      q.process();
      assert.deepEqual(q.processing, 1);
      done();
    });

    it('should decrement processing when worker is done', function(done) {
      var q = quargo({}, function(tasks, callback) {
        setTimeout(callback, 10);
      });
      q.mayProcess = function() {};

      assert.deepEqual(q.processing, 0);
      q.process();
      assert.deepEqual(q.processing, 1);

      setTimeout(function() {
        assert.deepEqual(q.processing, 0);
        done();
      }, 20);
    });

    it('should clear and remove timeout', function(done) {
      var q = quargo({
        capacity: 2,
        delay: 10
      }, function(tasks, callback) {
        setTimeout(callback, 10);
      });
      q.mayProcess = function() {};

      q.shouldProcess = function() {
        assert.fail();
      };

      assert.deepEqual(q.timeouts.length, 0);
      q.push('task');
      assert.deepEqual(q.timeouts.length, 1);
      q.process();
      assert.deepEqual(q.timeouts.length, 0);

      setTimeout(function() {
        done();
      }, 20);
    });

    it('should pass tasks to worker (less than capacity)', function(done) {
      var q = quargo({
        capacity: 3,
        delay: 10
      }, function(tasks) {
        assert.deepEqual(tasks, [1, 2]);
        done();
      });

      q.push([1, 2]);
    });

    it('should pass tasks to worker (the capacity)', function(done) {
      var q = quargo({
        capacity: 3,
        delay: 10
      }, function(tasks) {
        assert.deepEqual(tasks, [1, 2, 3]);
        done();
      });

      q.push([1, 2, 3]);
    });

    it('should pass tasks to worker (up to capacity)', function(done) {
      var q = quargo({
        capacity: 3,
        delay: 10
      }, function(tasks) {
        assert.deepEqual(tasks, [1, 2, 3]);
        done();
      });

      q.push([1, 2, 3, 4, 5]);
    });

    it('should call task callback with worker arguments', function(done) {
      var q = quargo({
        capacity: 1,
        delay: 10
      }, function(tasks, callback) {
        callback('arg1', 'arg2', 'arg3');
      });

      q.push('task', function(arg1, arg2, arg3) {
        assert.deepEqual(arg1, 'arg1');
        assert.deepEqual(arg2, 'arg2');
        assert.deepEqual(arg3, 'arg3');
        done();
      });
    });

    it('should call `empty` callback when passing the last task from queue', function(done) {
      var processingTasks = [];
      var q = quargo({
        capacity: 2,
        delay: 10
      }, function(tasks, callback) {
        processingTasks.push(tasks);
        callback();
      });

      q.empty = function() {
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(processingTasks, [[1, 2]]);
        done();
      };

      q.push([1, 2, 3]);
    });

    it('should call `drain` callback when the last task has been processed', function(done) {
      var processedTasks = [];
      var q = quargo({
        capacity: 2,
        delay: 10
      }, function(tasks, callback) {
        processedTasks.push(tasks);
        callback();
      });

      q.drain = function() {
        assert.deepEqual(q.idle(), true);
        assert.deepEqual(processedTasks, [[1, 2], [3]]);
        done();
      };

      q.push([1, 2, 3]);
    });

    it('should call `mayProcess` on next tick', function(done) {
      var q = quargo({
        capacity: 2,
        delay: 10
      }, function(tasks, callback) {
        assert.deepEqual(count, 0);
        setTimeout(callback, 20);
      });

      var count = 0;
      q.mayProcess = function() {
        count++;
      };

      q.push('task', function() {
        assert.deepEqual(count, 1);
      });

      assert.deepEqual(count, 0);
      q.process();

      setTimeout(function() {
        assert.deepEqual(count, 1);
      }, 15);

      setTimeout(function() {
        assert.deepEqual(count, 2);
        done();
      }, 25);
    });
  });

  describe('length', function() {
    it('should return the number of queued tasks', function(done) {
      var q = quargo({
        capacity: 10,
        delay: 20
      }, function() {});

      q.push([1, 2, 3]);

      assert.deepEqual(q.length(), 3);
      done();
    });

    it('should return the number of queued tasks and ignore processing tasks', function(done) {
      var processingTasks = null;
      var q = quargo({
        capacity: 2,
        concurrency: 1,
        delay: 20
      }, function(tasks) {
        processingTasks = tasks;
      });

      q.push([1, 2, 3, 4, 5]);

      setTimeout(function() {
        assert.deepEqual(processingTasks, [1, 2]);
        assert.deepEqual(q.length(), 3);
        done();
      }, 10);
    });
  });

  describe('idle', function() {
    it('should return true by default', function(done) {
      var q = quargo({}, function() {});
      assert.deepEqual(q.idle(), true);
      done();
    });

    it('should return false if tasks are queued', function(done) {
      var q = quargo({
        capacity: 5,
        delay: 40
      }, function() {});

      q.push([1, 2, 3]);

      assert.deepEqual(q.length(), 3);
      assert.deepEqual(q.idle(), false);
      done();
    });

    it('should return false if tasks are processing', function(done) {
      var processingTasks = null;
      var q = quargo({
        capacity: 3,
        delay: 40
      }, function(tasks) {
        processingTasks = tasks;
      });

      q.push([1, 2, 3]);

      setTimeout(function() {
        assert.deepEqual(processingTasks, [1, 2, 3]);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(q.idle(), false);
        done();
      }, 10);
    });

    it('should return true if tasks are done being processed', function(done) {
      var processingTasks = null;
      var q = quargo({
        capacity: 3,
        delay: 100
      }, function(tasks, callback) {
        processingTasks = tasks;
        setTimeout(function() {
          processingTasks = null;
          callback();
        }, 20);
      });

      q.push([1, 2, 3]);

      setTimeout(function() {
        assert.deepEqual(processingTasks, [1, 2, 3]);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(q.idle(), false);
      }, 10);

      setTimeout(function() {
        assert.deepEqual(processingTasks, null);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(q.idle(), true);
        done();
      }, 30);
    });
  });

  describe('running', function() {
    it('should return false by default', function(done) {
      var q = quargo({}, function() {});
      assert.deepEqual(q.running(), false);
      done();
    });

    it('should return false if tasks are queued', function(done) {
      var q = quargo({
        capacity: 5,
        delay: 40
      }, function() {});

      q.push([1, 2, 3]);

      assert.deepEqual(q.length(), 3);
      assert.deepEqual(q.running(), false);
      done();
    });

    it('should return true if tasks are processing', function(done) {
      var processingTasks = null;
      var q = quargo({
        capacity: 3,
        delay: 40
      }, function(tasks) {
        processingTasks = tasks;
      });

      q.push([1, 2, 3]);

      setTimeout(function() {
        assert.deepEqual(processingTasks, [1, 2, 3]);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(q.running(), true);
        done();
      }, 10);
    });

    it('should return false if tasks are done being processed', function(done) {
      var processingTasks = null;
      var q = quargo({
        capacity: 3,
        delay: 100
      }, function(tasks, callback) {
        processingTasks = tasks;
        setTimeout(function() {
          processingTasks = null;
          callback();
        }, 20);
      });

      q.push([1, 2, 3]);

      setTimeout(function() {
        assert.deepEqual(processingTasks, [1, 2, 3]);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(q.running(), true);
      }, 10);

      setTimeout(function() {
        assert.deepEqual(processingTasks, null);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(q.running(), false);
        done();
      }, 30);
    });
  });

  describe('flow', function() {
    it('should process tasks asap if reached capacity', function(done) {
      var q = quargo({
        capacity: 2,
        delay: 50
      }, function(tasks, cb) {
        cb();
      });

      var processed = 0;
      q.push([1, 2], function() {
        processed++;
      });

      setTimeout(function() {
        assert.deepEqual(processed, 2);
        done();
      }, 1);
    });

    it('should wait for `delay` before processing tasks', function(done) {
      var q = quargo({
        capacity: 10,
        delay: 55
      }, function(tasks, cb) {
        assert.deepEqual(tasks, [0, 1, 2, 3, 4]);
        cb();
      });

      var processed = 0;

      var pushWithDelay = function(i) {
        setTimeout(function() {
          q.push(i, function() {
            processed++;
          });
        }, i*10);
      };

      for (var i = 0; i < 5; i++) {
        pushWithDelay(i);
      }

      setTimeout(function() {
        assert.deepEqual(processed, 0);
        assert.deepEqual(q.length(), 5);
        setTimeout(function() {
          assert.deepEqual(processed, 5);
          assert.deepEqual(q.length(), 0);
          done();
        }, 4);
      }, 53);
    });

    it('should process up to `capacity` right away and remaining after delay', function(done) {
      var batch = 0;
      var q = quargo({
        capacity: 10,
        delay: 55
      }, function(tasks, cb) {
        batch++;
        if (batch === 1) {
          assert.deepEqual(tasks, [0, 0, 0, 1, 1, 1, 2, 2, 2, 3]);
        }
        else if (batch === 2) {
          assert.deepEqual(tasks, [3, 3, 4, 4, 4]);
        }
        else {
          assert.fail();
        }
        cb();
      });

      var processed = 0;

      var pushWithDelay = function(i) {
        setTimeout(function() {
          q.push([i, i, i], function() {
            processed++;
          });
        }, i*10);
      };

      for (var i = 0; i < 5; i++) {
        pushWithDelay(i);
      }

      setTimeout(function() {
        assert.deepEqual(processed, 0);
        assert.deepEqual(q.length(), 9);
        assert.deepEqual(batch, 0);
      }, 27);

      setTimeout(function() {
        assert.deepEqual(processed, 10);
        assert.deepEqual(q.length(), 2);
        assert.deepEqual(batch, 1);
      }, 33);

      setTimeout(function() {
        assert.deepEqual(processed, 10);
        assert.deepEqual(q.length(), 5);
        assert.deepEqual(batch, 1);
      }, 82);

      setTimeout(function() {
        assert.deepEqual(processed, 15);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(batch, 2);
        done();
      }, 88);
    });

    it('should use all available workers', function(done) {
      var batch = 0;

      var q = quargo({
        capacity: 4,
        concurrency: 2,
        delay: 55
      }, function(tasks, cb) {
        batch++;
        if (batch === 1) {
          assert.deepEqual(tasks, [0, 0, 0, 1]);
        }
        else if (batch === 2) {
          assert.deepEqual(tasks, [1, 1, 2, 2]);
        }
        else if (batch === 3) {
          assert.deepEqual(tasks, [2, 3, 3, 3]);
        }
        else if (batch === 4) {
          assert.deepEqual(tasks, [4, 4, 4]);
        }
        else {
          assert.fail();
        }
        setTimeout(cb, 28);
      });

      var processed = 0;

      var pushWithDelay = function(i) {
        setTimeout(function() {
          q.push([i, i, i], function() {
            processed++;
          });
        }, i*10);
      };

      for (var i = 0; i < 5; i++) {
        pushWithDelay(i);
      }

      // 10ms, add "1"s, triggers first batch with worker#1
      setTimeout(function() {
        assert.deepEqual(processed, 0);
        assert.deepEqual(q.length(), 3);
        assert.deepEqual(batch, 0);
      }, 7);
      setTimeout(function() {
        assert.deepEqual(processed, 0);
        assert.deepEqual(q.length(), 2);
        assert.deepEqual(batch, 1);
      }, 13);

      // 20ms, add "2"s, triggers second batch with worker#2
      setTimeout(function() {
        assert.deepEqual(processed, 0);
        assert.deepEqual(q.length(), 2);
        assert.deepEqual(batch, 1);
      }, 17);
      setTimeout(function() {
        assert.deepEqual(processed, 0);
        assert.deepEqual(q.length(), 1);
        assert.deepEqual(batch, 2);
      }, 23);

      // 30ms, add "3"s, they are queued
      setTimeout(function() {
        assert.deepEqual(processed, 0);
        assert.deepEqual(q.length(), 1);
        assert.deepEqual(batch, 2);
      }, 27);
      setTimeout(function() {
        assert.deepEqual(processed, 0);
        assert.deepEqual(q.length(), 4);
        assert.deepEqual(batch, 2);
      }, 33);

      // 40ms, add "4"s, they are queued; first batch completes, third batch begins with worker#1
      setTimeout(function() {
        assert.deepEqual(processed, 0);
        assert.deepEqual(q.length(), 4);
        assert.deepEqual(batch, 2);
      }, 37);
      setTimeout(function() {
        assert.deepEqual(processed, 4);
        assert.deepEqual(q.length(), 3);
        assert.deepEqual(batch, 3);
      }, 44);

      // 50ms, second batch completes, worker#2 goes idle
      setTimeout(function() {
        assert.deepEqual(processed, 4);
        assert.deepEqual(q.length(), 3);
        assert.deepEqual(batch, 3);
      }, 47);
      setTimeout(function() {
        assert.deepEqual(processed, 8);
        assert.deepEqual(q.length(), 3);
        assert.deepEqual(batch, 3);
      }, 53);

      // 70ms, third batch completes, worker#1 goes idle
      setTimeout(function() {
        assert.deepEqual(processed, 8);
        assert.deepEqual(q.length(), 3);
        assert.deepEqual(batch, 3);
      }, 67);
      setTimeout(function() {
        assert.deepEqual(processed, 12);
        assert.deepEqual(q.length(), 3);
        assert.deepEqual(batch, 3);
      }, 73);

      // 95ms, timer expires for "4"s, they are passed to worker#1
      setTimeout(function() {
        assert.deepEqual(processed, 12);
        assert.deepEqual(q.length(), 3);
        assert.deepEqual(batch, 3);
        assert.deepEqual(q.running(), false);
      }, 92);
      setTimeout(function() {
        assert.deepEqual(processed, 12);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(batch, 4);
        assert.deepEqual(q.running(), true);
      }, 98);

      // 125ms, fourth batch completes, worker#1 goes idle
      setTimeout(function() {
        assert.deepEqual(processed, 12);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(batch, 4);
        assert.deepEqual(q.running(), true);
      }, 122);
      setTimeout(function() {
        assert.deepEqual(processed, 15);
        assert.deepEqual(q.length(), 0);
        assert.deepEqual(batch, 4);
        assert.deepEqual(q.running(), false);
        assert.deepEqual(q.idle(), true);
        done();
      }, 128);
    });
  });
});
