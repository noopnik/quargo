/*!
 * quargo
 * https://github.com/pierreliefauche/quargo
 *
 * Copyright 2014 Pierre-Élie Fauché
 * Released under the MIT license
 */
/*jshint onevar: false, indent:2 */
/*global setTimeout: false */

module.exports = function(worker, capacity, concurrency, delay) {
  var config = {};

  /**
   * Initialization, async-like or with options object
   */
  if (typeof worker === 'function') {
    if (typeof capacity === 'object') {
      // quargo(worker, config);
      config = capacity;
    }
    else {
      // quargo(worker, capacity, concurrency, delay);
      config.capacity = capacity;
      config.concurrency = concurrency;
      config.delay = delay;
    }
  }
  else {
    // quargo(config, worker);
    config = worker;
    worker = capacity;
  }


  var self = {
    capacity: config.capacity || 1,
    delay: config.delay || 0,
    concurrency: config.concurrency || 1,

    tasks: [],
    timeouts: [],
    urging: 0,
    processing: 0,

    empty: config.empty || null,
    drain: config.drain || null,
  };


  /**
   * Add a task or an array of tasks to the quargo
   *
   * @param  {Object|Array|Number|String} data      Task or array of tasks
   * @param  {Function}                   callback  Optional callback called when task has been processed
   * @return {Object}                               Self for chaining
   */
  self.push = function(data, callback) {
    [].concat(data).forEach(function(task) {
      self.tasks.push({
        data: task,
        callback: typeof callback === 'function' ? callback : null
      });
    });

    while (Math.ceil(self.tasks.length / self.capacity) > self.timeouts.length) {
      self.timeouts.push(setTimeout(self.shouldProcess, self.delay));
    }

    setTimeout(self.mayProcess, 0);

    return self;
  };

  /**
   * Timer expired, process tasks even if capacity is not reached
   */
  self.shouldProcess = function() {
    self.mayProcess(true);
  };

  /**
   * Trigger processing if workers are available and
   * - capacity is reached
   * - or tasks should be processed ASAP
   *
   * @param  {Boolean} urgent A batch should be processed ASAP
   */
  self.mayProcess = function(urgent) {
    if (urgent) {
      self.urging++;
    }

    // Try to process while at least one worker is available
    while (self.processing < self.concurrency) {
      if (self.urging > 0) {
        self.urging--;
        self.process();
      }
      else if (self.tasks.length >= self.capacity) {
        self.process();
      }
      else {
        break;
      }
    }
  };

  /**
   * Process a batch of tasks.
   * Tries to process as much as possible, up to `capacity`.
   */
  self.process = function() {
    self.processing++;

    clearTimeout(self.timeouts.shift());
    var batch = self.tasks.splice(0, self.capacity);

    if (self.empty && self.tasks.length === 0) {
      self.empty();
    }

    var data = batch.map(function(task) {
      return task.data;
    });

    worker(data, function() {
      var args = arguments;

      batch.forEach(function(task) {
        if (task.callback) {
          task.callback.apply(null, args);
        }
      });

      self.processing--;

      if (self.drain && self.idle()) {
        self.drain();
      }

      setTimeout(self.mayProcess, 0);
    });
  };


  /**
   * Number of tasks waiting to be processed
   * @return {Number}
   */
  self.length = function() {
    return self.tasks.length;
  };

  /**
   * Are any tasks waiting to be processed or being currently processed?
   * @return {Boolean}
   */
  self.idle = function() {
    return self.tasks.length === 0 && self.processing === 0;
  };

  /**
   * Are any tasks being currently processed?
   * @return {Boolean}
   */
  self.running = function() {
    return self.processing > 0;
  };

  return self;
};
