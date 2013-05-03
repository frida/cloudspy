define(function () {
    'use strict';

    var Deferred = function Deferred() {
        var state = 'pending';
        var doneCallbacks = [],
            failCallbacks = [],
            alwaysCallbacks = [];
        var result = [];

        this.promise = function promise(candidate) {
            candidate = candidate || {};
            candidate.state = function getState() {
                return state;
            };

            var storeCallbacks = function storeCallbacks(shouldExecuteImmediately, holder) {
                return function() {
                    if (state === 'pending') {
                        holder.push.apply(holder, arguments);
                    }
                    if (shouldExecuteImmediately()) {
                        execute(null, arguments, result);
                    }
                    return candidate;
                };
            };
            var pipe = function pipe(doneFilter, failFilter) {
                var deferred = new Deferred();
                var filter = function filter(target, source, filterFunc) {
                    if (filterFunc) {
                        target(function() {
                            var val = filterFunc.apply(null, arguments);
                            if (isPromise(val)) {
                                val.done(function () { deferred.resolve.apply(this, arguments); });
                                val.fail(function () { deferred.reject.apply(this, arguments); });
                            } else {
                                source(val);
                            }
                        });
                    } else {
                        target(function() {
                            source.apply(null, arguments);
                        });
                    }
                };
                filter(candidate.done, deferred.resolve, doneFilter);
                filter(candidate.fail, deferred.reject, failFilter);
                return deferred;
            };
            candidate.done = storeCallbacks(function() {return state === 'resolved';}, doneCallbacks);
            candidate.fail = storeCallbacks(function() {return state === 'rejected';}, failCallbacks);
            candidate.always = storeCallbacks(function() {return state !== 'pending';}, alwaysCallbacks);
            candidate.pipe = pipe;
            candidate.then = pipe;
            return candidate;
        };
        this.promise(this);

        var close = function close(finalState, callbacks) {
            return function() {
                if (state === 'pending') {
                    state = finalState;
                    result = [].slice.call(arguments);
                    execute(null, callbacks.concat(alwaysCallbacks), result);
                }
                return this;
            };
        };
        var closeWith = function closeWith(finalState, callbacks) {
            return function(context) {
                if (state === 'pending') {
                    state = finalState;
                    result = [].slice.call(arguments, 1);
                    execute(context, callbacks.concat(alwaysCallbacks), result);
                }
                return this;
            };
        };
        this.resolve = close('resolved', doneCallbacks);
        this.resolveWith = closeWith('resolved', doneCallbacks);
        this.reject = close('rejected', failCallbacks);
        this.rejectWith = closeWith('rejected', failCallbacks);
        return this;
    };

    Deferred.when = function when() {
        var subordinates = Array.prototype.slice.call(arguments, 0),
            remaining = subordinates.length,
            results = [],
            failed = false,
            d = new Deferred();

        if (remaining === 0) {
            d.resolve();
        }

        subordinates.forEach(function waitForSubordinate(subordinate, i) {
            subordinate.done(function success() {
                results[i] = Array.prototype.slice.call(arguments, 0);
                remaining--;
                if (remaining === 0 && !failed) {
                    d.resolve.apply(d, results);
                }
            });
            subordinate.fail(function failure() {
                remaining--;
                if (!failed) {
                    failed = true;
                    d.reject.apply(d, arguments);
                }
            });
        });

        return d.promise();
    };

    var execute = function execute(context, callbacks, args) {
        for (var i = 0; i < callbacks.length; i++) {
            callbacks[i].apply(context, args);
        }
    };

    // We allow duck-typing to interop with conformant Deferred implementations
    var isPromise = function isPromise(o) {
        return o && o.state && o.done && o.fail && o.always && o.pipe && o.then;
    };

    return Deferred;
});
