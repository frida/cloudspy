define(['app/views/view'], function (View) {
    'use strict';

    var App = View.define({
        initialize: function initialize() {
            this._page = this.element.querySelector("[data-view='page']");
        },
        resume: function resume() {
            this.element.style.display = 'block';
        },
        show: function show(view) {
            var container = this._page;
            while (container.firstElementChild) {
                container.removeChild(container.firstElementChild);
            }
            if (view) {
                container.appendChild(view.element);
            }
        }
    });

    return App;
});
