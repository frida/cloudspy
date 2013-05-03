define(['app/views/template', 'text!templates/session.html'], function (Template, template) {
    'use strict';

    var Session = Template.define({
        initialize: function initialize() {
            Session['__super__'].initialize.call(this, '/session', template);

            this._connect("button.detach", 'click', this._onDetachClick);
            this._connect("button.close", 'click', this._onCloseClick);
        },
        _onDetachClick: function _onDetachClick() {
            this.events.trigger('detach');
        },
        _onCloseClick: function _onCloseClick() {
            this.events.trigger('close');
        }
    });

    return Session;
});
