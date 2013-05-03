define(['app/views/view'], function (View) {
    'use strict';

    var appendColumn = function appendColumn(row, content) {
        var col = document.createElement('td');
        col.textContent = content;
        row.appendChild(col);
        return col;
    };

    var ctrlModifier, ctrlKeyCode;
    if (navigator.platform === 'MacIntel') {
        ctrlModifier = 'metaKey';
        ctrlKeyCode = 91;
    } else {
        ctrlModifier = 'ctrlKey';
        ctrlKeyCode = 17;
    }

    var Summary = View.define({
        initialize: function initialize() {
            this._headers = this.element.querySelector(".headers");
            this._viewport = this.element.querySelector(".content");
            this._content = this._viewport.querySelector("table");

            this._connect(this._viewport, 'scroll', this._onScroll);

            this._connect(this._content, 'mousewheel', this._onMouseWheel);
            this._connect(this._content, 'click', this._onClick);
            this._connect(this._content, 'dblclick', this._onDoubleClick);
            this._connect(this._content, 'keydown', this._onKeyDown);
            this._connect(this._content, 'keyup', this._onKeyUp);

            this._connect(window, 'resize', this._updateHeaders);

            this._reset();
        },
        resume: function resume() {
            this._updateHeaders();
            this.render();
        },
        render: function render() {
            var modified = false,
                partial = false,
                total = this.presenter.getTotal(),
                items,
                row,
                i;

            if (total <= 0) {
                this._reset();
                while (this._content.firstElementChild) {
                    this._content.removeChild(this._content.firstElementChild);
                }
            } else {
                if (this._rowHeight === null) {
                    items = this.presenter.getItems(this._topIndex, 1);
                    if (items.length === 0) {
                        return;
                    }
                    row = this._createRow(items[0], this._topIndex);
                    this._content.appendChild(row);
                    this._rowHeight = row.offsetHeight;
                    if (this._rowHeight === 0) {
                        // Too early, we are probably not visible
                        this._rowHeight = null;
                        this._content.removeChild(row);
                        return;
                    }
                    this._rowsPerPage = Math.round(this._viewport.clientHeight / this._rowHeight);
                    this._bottomIndex = 1;
                    this._updateHeaders();
                    modified = true;
                }

                var extra = 1;
                var topIndex = Math.max(Math.floor(this._viewport.scrollTop / this._rowHeight) - extra, 0);
                var bottomIndex = Math.min(extra + topIndex + this._rowsPerPage + extra, total);

                var fillAbove = this._topIndex - topIndex;
                if (fillAbove > 0) {
                    if (topIndex < this._topIndex - this._rowsPerPage) {
                        while (this._bottomIndex > this._topIndex) {
                            if (this._content.firstElementChild) {
                                this._content.removeChild(this._content.firstElementChild);
                            }
                            this._bottomIndex--;
                        }
                        this._topIndex = bottomIndex;
                        this._bottomIndex = bottomIndex;
                        fillAbove = this._topIndex - topIndex;
                    }

                    items = this.presenter.getItems(topIndex, fillAbove);
                    for (i = items.length - 1; i >= 0; i--) {
                        row = this._createRow(items[i], topIndex + i);
                        this._content.insertBefore(row, this._content.firstElementChild);
                        this._topIndex--;
                    }
                    this._content.style.marginTop = (topIndex * this._rowHeight) + "px";
                    modified = true;
                    partial = items.length !== fillAbove;
                }

                if (!partial) {
                    var fillBelow = bottomIndex - this._bottomIndex;
                    if (fillBelow > 0) {
                        if (topIndex > this._bottomIndex + this._rowsPerPage) {
                            while (this._bottomIndex > this._topIndex) {
                                if (this._content.firstElementChild) {
                                    this._content.removeChild(this._content.firstElementChild);
                                }
                                this._bottomIndex--;
                            }
                            this._topIndex = topIndex;
                            this._bottomIndex = topIndex;
                            this._content.style.marginTop = (this._topIndex * this._rowHeight) + "px";
                            fillBelow = bottomIndex - this._bottomIndex;
                        }

                        var previousBottomIndex = this._bottomIndex;
                        items = this.presenter.getItems(this._bottomIndex, fillBelow);
                        for (i = 0; i !== items.length; i++) {
                            row = this._createRow(items[i], previousBottomIndex + i);
                            this._content.appendChild(row);
                            this._bottomIndex++;
                        }
                        modified = true;
                        partial = items.length !== fillBelow;
                    }
                }

                if (!partial) {
                    var trimAbove = topIndex - this._topIndex;
                    if (trimAbove > 0) {
                        for (i = 0; i < trimAbove; i++) {
                            if (this._content.firstElementChild) {
                                this._content.removeChild(this._content.firstElementChild);
                            } else {
                                break;
                            }
                        }
                        this._topIndex = topIndex;
                        this._content.style.marginTop = (this._topIndex * this._rowHeight) + "px";
                        modified = true;
                    }

                    var trimBelow = this._bottomIndex - bottomIndex;
                    if (trimBelow > 0) {
                        for (i = 0; i < trimBelow; i++) {
                            if (this._content.lastElementChild) {
                                this._content.removeChild(this._content.lastElementChild);
                            } else {
                                break;
                            }
                        }
                        this._bottomIndex = bottomIndex;
                        modified = true;
                    }
                }

                this._content.style.marginBottom = ((total - this._bottomIndex) * this._rowHeight) + "px";
            }

            if (modified && this._scrollPosition === 'end') {
                this._scrollToEnd();
            }
        },
        _reset: function _reset() {
            this._rowHeight = null;
            this._rowsPerPage = null;
            this._topIndex = 0;
            this._bottomIndex = 0;
            this._scrollPosition = 'end';
            this._selected = [];
            this._shiftPressed = false;
            this._ctrlPressed = false;
            this._content.style.marginTop = "0px";
            this._content.style.marginBottom = "0px";
        },
        _createRow: function _createRow(item, index) {
            var ev = item.event;

            var row = document.createElement('tr');
            row.classList.add('item');
            if (this._selected.indexOf(index) !== -1) {
                row.classList.add('selected');
            }

            appendColumn(row, item._id);

            var type = appendColumn(row, '');
            var icon = document.createElement('div');
            icon.classList.add('icon');
            icon.classList.add('icon-' + ev.type);
            type.appendChild(icon);

            var timestamp = new Date(item.timestamp).toTimeString();
            timestamp = timestamp.substring(0, timestamp.indexOf(" "));
            appendColumn(row, timestamp);

            appendColumn(row, ev.name);

            var keys = Object.keys(ev.properties);
            keys.sort();
            appendColumn(row, keys.map(function (key) {
                return key + "=" + ev.properties[key];
            }).join(" "));

            return row;
        },
        _updateHeaders: function _updateHeaders() {
            var first = this._content.firstElementChild;
            if (first !== null) {
                var widths = [],
                    children = first.children,
                    i;
                for (i = 0; i !== children.length; i++) {
                    var w = window.getComputedStyle(children[i]).width;
                    if (w === 'auto') {
                        return;
                    }
                    widths.push(parseInt(w, 10));
                }

                children = this._headers.firstElementChild.firstElementChild.children;
                for (i = 0; i !== children.length; i++) {
                    if (i < children.length - 1) {
                        children[i].style.width = widths[i] + "px";
                    } else {
                        children[i].style.width = 'auto';
                    }
                }
            }
        },
        _scrollToEnd: function _scrollToEnd() {
            var el = this._viewport;
            el.scrollTop = el.scrollHeight - el.clientHeight;
            this._scrollPosition = 'end';
        },
        _rowIndex: function _rowIndex(row) {
            var distance = parseInt(this._content.style.marginTop, 10) + row.offsetTop;
            return Math.floor(distance / this._rowHeight);
        },
        _selectAll: function _selectAll() {
            var total = this.presenter.getTotal();
            if (total > 0) {
                this._selected = [];
                for (var i = 0; i !== total; i++) {
                    this._selected.push(i);
                }
                this._selected.reverse();
                this._updateSelected();
                this.events.trigger('select', this._selected);
            }
        },
        _selectWithKeyboard: function _selectWithKeyboard(index) {
            if (this._shiftPressed) {
                this._selectTo(index);
            } else {
                this._selected = [index];
            }
            this._updateSelected();
            this._scrollToLastSelected();
            this.events.trigger('select', this._selected);
        },
        _selectWithMouse: function _selectWithMouse(index) {
            if (this._shiftPressed) {
                this._selectTo(index);
            } else {
                if (!this._ctrlPressed) {
                    this._selected = [];
                }
                if (this._selected.indexOf(index) === -1) {
                    this._selected.push(index);
                } else {
                    this._selected.splice(this._selected.indexOf(index), 1);
                }
            }
            this._updateSelected();
            this.events.trigger('select', this._selected);
        },
        _selectTo: function _selectTo(index) {
            var firstSelected,
                lastSelected,
                increment,
                i;

            lastSelected = index;
            if (this._selected.length > 0) {
                firstSelected = this._selected[0];
            } else {
                firstSelected = lastSelected;
            }
            increment = lastSelected >= firstSelected ? 1 : -1;

            this._selected = [];
            for (i = firstSelected; i !== lastSelected + increment; i += increment) {
                this._selected.push(i);
            }
        },
        _updateSelected: function _updateSelected() {
            var children = this._content.children;
            for (var i = 0; i !== children.length; i++) {
                var child = children[i];
                if (this._selected.indexOf(this._rowIndex(child)) !== -1) {
                    child.classList.add('selected');
                } else {
                    child.classList.remove('selected');
                }
            }
        },
        _scrollToLastSelected: function _scrollToLastSelected() {
            var viewportTop = this._viewport.scrollTop;
            var viewportBottom = viewportTop + this._viewport.clientHeight;
            var rowTop = this._selected[this._selected.length - 1] * this._rowHeight;
            var rowBottom = rowTop + this._rowHeight;
            if (rowTop < viewportTop) {
                this._viewport.scrollTop = rowTop;
            } else if (rowBottom > viewportBottom) {
                this._viewport.scrollTop = rowBottom - this._viewport.clientHeight + 1;
            }
        },
        _onScroll: function _onScroll() {
            this._scrollPosition = this._computeScrollPosition();
            this.render();
        },
        _computeScrollPosition: function _computeScrollPosition() {
            var el = this._viewport;
            if (el.scrollTop === el.scrollHeight - el.clientHeight) {
                return 'end';
            } else if (el.scrollTop === 0) {
                return 'start';
            }
            return 'middle';
        },
        _onMouseWheel: function _onMouseWheel(event) {
            var dY = event.wheelDeltaY;
            if (dY !== 0 && this._rowHeight !== null) {
                var distance;
                if (dY % 120 === 0) {
                    distance = (dY / 120) * -1;
                } else {
                    distance = (dY < 0) ? 1 : -1;
                }
                var viewportTop = this._viewport.scrollTop;
                this._viewport.scrollTop = (Math.floor(viewportTop / this._rowHeight) + distance) * this._rowHeight;
                event.stopPropagation();
                event.preventDefault();
            }
        },
        _onClick: function _onClick(event) {
            if (event.button === 0) {
                var row = null,
                    element = event.target;
                while (element && element !== this.element) {
                    if (element.tagName === 'TR' && element.classList.contains('item')) {
                        row = element;
                        break;
                    }
                    element = element.parentElement;
                }

                if (row !== null) {
                    this._selectWithMouse(this._rowIndex(row));
                    event.stopPropagation();
                    event.preventDefault();
                }
            }
        },
        _onDoubleClick: function _onDoubleClick() {
            this._selectAll();
        },
        _onKeyDown: function _onKeyDown(event) {
            var index;
            switch (event.keyCode) {
                case 33: // Page up
                case 34: // Page down
                case 38: // Arrow up
                case 40: // Arrow down
                    if (this._selected.length > 0) {
                        index = this._selected[this._selected.length - 1];
                        switch (event.keyCode) {
                            case 33:
                                index -= this._rowsPerPage;
                                break;
                            case 34:
                                index += this._rowsPerPage;
                                break;
                            case 38:
                                index--;
                                break;
                            case 40:
                                index++;
                                break;
                        }
                        index = Math.max(Math.min(index, this.presenter.getTotal() - 1), 0);
                        this._selectWithKeyboard(index);
                        event.stopPropagation();
                        event.preventDefault();
                    }
                    break;
                case 36: // Home
                case 35: // End
                    if (this._selected.length > 0) {
                        index = (event.keyCode === 36) ? 0 : this.presenter.getTotal() - 1;
                        this._selectWithKeyboard(index);
                        event.stopPropagation();
                        event.preventDefault();
                    }
                    break;
                case 65: // 'A'
                    if (event[ctrlModifier]) {
                        this._selectAll();
                        event.stopPropagation();
                        event.preventDefault();
                    }
                    break;
                case 16:
                    this._shiftPressed = true;
                    break;
                default:
                    if (event.keyCode === ctrlKeyCode) {
                        this._ctrlPressed = true;
                    }
                    break;
            }
        },
        _onKeyUp: function _onKeyUp(event) {
            if (event.keyCode === 16) {
                this._shiftPressed = false;
            } else if (event.keyCode === ctrlKeyCode) {
                this._ctrlPressed = false;
            }
        }
    });

    return Summary;
});
