
module.exports = function(worker, capacity, concurrency, delay) {
  var config = {};

  if (typeof capacity === 'object') {
    config = capacity;
  }
  else {
    config.capacity = capacity;
    config.concurrency = concurrency;
    config.delay = delay;
  }


  var self = {
    capacity: config.capacity || null,
    delay: config.delay || 0,
    concurrency: config.concurrency || 1,

    tasks: [],
    timeouts: [],
    urging: 0,
    processing: 0,

    empty: null,
    drain: null,
  };


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

    self.mayProcess();
  };

  self.shouldProcess = function() {
    self.mayProcess(true);
  };

  self.mayProcess = function(urgent) {
    if (urgent) {
      self.urging++;
    }

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

      self.mayProcess();
    });
  };


  self.length = function() {
    return self.tasks.length;
  };

  self.idle = function() {
    return self.tasks.length === 0 && self.processing === 0;
  };

  self.running = function() {
    return self.processing > 0;
  };






  return self;
};
