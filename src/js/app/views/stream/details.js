define(['app/views/view'], function (View) {
    'use strict';

    var Details = View.define({
        initialize: function initialize() {
            this._connect(window, 'resize', this._updateHeight);
        },
        resume: function resume() {
            this._updateHeight();
        },
        clear: function clear() {
            var content = this.element;
            while (content.firstChild) {
                content.removeChild(content.firstChild);
            }
        },
        add: function add(items) {
            items.forEach(function (item) {
                var ev = item.event,
                    prefix,
                    container,
                    line,
                    i;
                if (ev.type === 'incoming' || ev.type === 'outgoing') {
                    prefix = document.createElement('span');
                    prefix.classList.add('prefix');
                    prefix.classList.add('prefix-' + ev.type);
                    prefix.textContent = (ev.type === 'incoming') ? "<<" : ">>";

                    container = document.createElement('div');
                    container.classList.add('item-data');

                    line = document.createElement('div');
                    line.appendChild(prefix.cloneNode(true));
                    line.appendChild(document.createTextNode(".¸¸.· #" + item._id));
                    container.appendChild(line);

                    var asciiLines = window.atob(item.payload).split("\n");
                    for (i = 0; i !== asciiLines.length; i++) {
                        line = document.createElement('div');
                        line.appendChild(prefix.cloneNode(true));
                        line.appendChild(document.createTextNode(asciiLines[i]));
                        container.appendChild(line);
                    }

                    this.element.appendChild(container);
                }
            }.bind(this));
        },
        _updateHeight: function _updateHeight() {
            var windowHeight = window.innerHeight;
            var appHeight = parseInt(window.getComputedStyle(window.document.body.firstElementChild).height, 10);
            var ourHeight = parseInt(window.getComputedStyle(this.element).height, 10);
            this.element.style.height = Math.max(ourHeight + windowHeight - appHeight, 200) + "px";
        }
    });

    return Details;
});
