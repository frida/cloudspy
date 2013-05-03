define(['app/views/view'], function (View) {
    'use strict';

    var Capture = View.define({
        initialize: function initialize(project) {
            this._project = project;

            this._devices = this.element.querySelector("[data-view='devices']");
            this._processes = this.element.querySelector("[data-view='processes']");
            this._sessions = this.element.querySelector("[data-view='sessions']");

            this._connect(this._devices, 'change', this._onDeviceChange);
            this._connect("[data-action='refresh']", 'click', this._onRefreshClick);
            this._connect("[data-action='attach']", 'click', this._onAttachClick);
        },
        update: function update(properties) {
            var container;

            if ('devices' in properties) {
                var devices = properties['devices'];
                container = this._devices;
                while (container.firstElementChild) {
                    container.removeChild(container.firstElementChild);
                }
                devices.forEach(function addDevice(device) {
                    var element = document.createElement('option');
                    element.textContent = device.name;
                    element.value = device.id;
                    container.appendChild(element);
                });
                this.events.trigger('device-selected', devices[0].id);
            }

            if ('processes' in properties) {
                container = this._processes;
                while (container.firstElementChild) {
                    container.removeChild(container.firstElementChild);
                }
                properties['processes'].forEach(function addProcess(process) {
                    var element = document.createElement('option');
                    element.textContent = process.name;
                    element.value = process.pid;
                    container.appendChild(element);
                });
            }

            Capture['__super__'].update.call(this, properties);
        },
        selectDevice: function selectDevice(deviceId) {
            var children = this._devices.children;
            for (var i = 0; i !== children.length; i++) {
                if (parseInt(children[i].value, 10) === deviceId) {
                    this._devices.selectedIndex = i;
                    this.events.trigger('device-selected', deviceId);
                    break;
                }
            }
        },
        addSession: function addSession(view) {
            this._sessions.appendChild(view.element);
            this._project.render();
        },
        removeSession: function removeSession(view) {
            this._sessions.removeChild(view.element);
            this._project.render();
        },
        displayError: function displayError(error) {
            var element = document.createElement('div');
            element.classList.add('notification');
            element.classList.add('notification-error');
            element.textContent = error;
            this.element.appendChild(element);
            window.setTimeout(function expireNotification() {
                this.element.removeChild(element);
            }.bind(this), 5000);
        },
        _onDeviceChange: function _onDeviceChange() {
            this.events.trigger('device-selected', parseInt(this._devices.value, 10));
        },
        _onRefreshClick: function _onRefreshClick() {
            this.events.trigger('device-selected', parseInt(this._devices.value, 10));
        },
        _onAttachClick: function _onAttachClick() {
            this.events.trigger('attach', parseInt(this._devices.value, 10), parseInt(this._processes.value, 10));
        }
    });

    return Capture;
});
