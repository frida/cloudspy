define(['app/views/view', 'app/views/stream/summary', 'app/views/stream/details'], function (View, Summary, Details) {
    'use strict';

    var Stream = View.define({
        initialize: function initialize() {
            this.summary = new Summary(this.element.querySelector("[data-view='summary']"));
            this.details = new Details(this.element.querySelector("[data-view='details']"));

            this._connect("[data-action='clear']", 'click', this._onClearClick);
        },
        resume: function resume() {
            this.summary.resume();
            this.details.resume();
        },
        _onClearClick: function _onClearClick() {
            this.events.trigger('clear');
        }
    });

    return Stream;
});
