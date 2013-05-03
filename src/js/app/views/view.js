define(['deferred', 'events', 'extend'], function(Deferred, Events, extend) {
    'use strict';

    var View = function View(element) {
        this.element = element;
        this.events = new Events();
        this._updates = {};
        this._updatesTimer = null;
        this._updatesDeferred = null;
        this._connections = [];

        this.initialize.apply(this, [].slice.call(arguments, 1));
    };
    View.prototype = {
        initialize: function initialize() {},
        dispose: function dispose() {
            this._disconnectAll();
            clearTimeout(this._updatesTimer);
        },
        update: function update(properties) {
            merge(this._updates, properties);
            if (this._updatesTimer === null) {
                this._updatesDeferred = new Deferred();
                this._updatesTimer = setTimeout(this.flushUpdates.bind(this), 10);
            }
            return this._updatesDeferred.promise();
        },
        flushUpdates: function flushUpdates() {
            deepUpdate(this.element.children, this._updates);
            this._updates = {};
            if (this._updatesTimer !== null) {
                clearTimeout(this._updatesTimer);
                this._updatesTimer = null;
            }
            if (this._updatesDeferred !== null) {
                this._updatesDeferred.resolve();
                this._updatesDeferred = null;
            }
        },
        _connect: function _connect(target, event, callback) {
            var result = null;
            if (typeof target === 'string') {
                result = this.element.querySelector(target);
                if (result === null) {
                    throw new Error("No element matching " + target);
                }
            } else {
                result = target;
            }

            var connection = {
                element: result,
                event: event,
                callback: callback.bind(this)
            };
            connection.element.addEventListener(connection.event, connection.callback, false);
            this._connections.push(connection);
        },
        _disconnectAll: function _disconnectAll() {
            for (var i = 0; i < this._connections.length; i++) {
                var connection = this._connections[i];
                connection.element.removeEventListener(connection.event, connection.callback, false);
            }
            this._connections = [];
        },
        _show: function _show() {
            this.element.style.display = "";
        },
        _hide: function _hide() {
            this.element.style.display = "none";
        }
    };
    View.define = extend;

    var deepUpdate = function deepUpdate(elements, properties) {
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            update(element, properties);
            if (!element.hasAttribute('data-view')) {
                deepUpdate(element.children, properties);
            }
        }
    };

    var update = function update(element, properties) {
        for (var i = 0; i < element.attributes.length; i++) {
            var attribute = element.attributes[i];
            var match = attribute.name.match(/^data-(show|hide|visible|invisible|text|html|value|checked|unchecked|enabled|disabled|(attr)-([a-z\-]+)|(class)-([a-z\-]+))$/);
            if (match != null) {
                var value = lookup(properties, attribute.value);
                if (value !== undefined) {
                    switch (match[1]) {
                        case 'show':
                            element.style.display = value ? '' : 'none';
                            break;
                        case 'hide':
                            element.style.display = value ? 'none' : '';
                            break;
                        case 'visible':
                            element.style.visibility = value ? '' : 'hidden';
                            break;
                        case 'invisible':
                            element.style.visibility = value ? 'hidden' : '';
                            break;
                        case 'text':
                            element.textContent = value;
                            break;
                        case 'html':
                            element.innerHTML = value;
                            break;
                        case 'value':
                            element.value = value;
                            break;
                        case 'checked':
                            element.checked = value;
                            break;
                        case 'unchecked':
                            element.checked = !value;
                            break;
                        case 'enabled':
                            element.disabled = !value;
                            break;
                        case 'disabled':
                            element.disabled = value;
                            break;
                        default:
                            if (match[2] === 'attr') {
                                element.setAttribute(match[3], value);
                            } else if (match[4] === 'class') {
                                if (element.classList) {
                                    element.classList[value ? 'add' : 'remove'](match[5]);
                                } else {
                                    var className = match[5],
                                        regex = new RegExp('(^|\\s+)' + className + '(\\s+|$)'),
                                        hasClass = regex.test(element.className);
                                    if (hasClass && !value) {
                                        element.className = element.className.replace(hasClass, ' ').trim();
                                    } else if (value && !hasClass) {
                                        element.className = element.className + ' ' + className;
                                    }
                                }
                            }
                    }
                }
            }
        }
    };

    var merge = function merge(target, updates) {
        Object.keys(updates).forEach(function (key) {
            target[key] = updates[key];
        });
    };

    var lookup = function lookup(properties, key) {
        var path = key.split('.');
        var value = properties;
        for (var i = 0; i < path.length; i++) {
            if (value === undefined) {
                return undefined;
            } else if (value === null) {
                return null;
            }
            value = value[path[i]];
        }
        return value;
    };

    return View;
});
