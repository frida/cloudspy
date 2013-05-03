define(['app/views/view'], function (View) {
    'use strict';

    var parseHtml = function parseHtml(string) {
        var container = document.createElement('div');
        container.innerHTML = string;
        return container.childNodes[0];
    };

    var Template = View.define({
        initialize: function initialize(id, template) {
            var element = Template._cache[id];
            if (!element) {
                element = Template._cache[id] = parseHtml(template);
            }
            this.element = element.cloneNode(true);
        },
        dispose: function dispose() {
            if (this.element.parentElement) {
                this.element.parentElement.removeChild(this.element);
            }
            Template['__super__'].dispose.call(this);
        }
    });
    Template._cache = {};

    return Template;
});
