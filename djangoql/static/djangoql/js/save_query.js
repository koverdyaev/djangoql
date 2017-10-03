(function (DjangoQL) {
  'use strict';

  if (!$) {var $ = django.jQuery;}

  var selectedQuery = {id: null, text: ''};

  function textWithoutChildren($elem) {
    return $elem.contents().filter(function() {
      return this.nodeType === 3;
    })[0].nodeValue;
  }

  function checkSaveAvailability(e) {
    var $target = $(e.target);
    var $saveButton = $('#save-query');
    if ($target.val().length) {
      $saveButton.prop('disabled', false);
    } else {
      $saveButton.prop('disabled', true);
    }
    return false;
  }

  function filterQueries() {
    var filter = $('#save-query-filter').val().toUpperCase();
    var queryList = $('a.query');
    queryList.each(function (i, query) {
      var $query = $(query);
      if (textWithoutChildren($query).toUpperCase().indexOf(filter) > -1) {
        $query.css('display', "");
      } else {
        $query.css('display', "none");
      }
    });
    return false;
  }

  function toggleSaveMenu() {
    $('#querySaveMenu').toggleClass('show');
    return false;
  }

  function highlightQuery($target, queryId) {
    if ($target === null) {
      $target = $('a[query_id=' + queryId +']');
    }

    $('a.query').removeClass('selected-query');
    $target.addClass('selected-query');
  }

  function updateSearchInput(text) {
    $('textarea[name=q]').val(text);
  }

  function publicQueryTemplate(query) {
    return (
      '<a href="#" class="query" query_text="' + query.text + '" query_id="' + query.id + '" >' +
        query.name +
      '</a>'
    );
  }

  function ownQueryTemplate(query) {
    return (
      '<a href="#" class="query" query_text="' + query.text + '" query_id="' + query.id + '" >' +
        query.name +
        '<span class="button deleteQuery">delete</span>' +
      '</a>'
    );
  }

  function populate($queriesContainer, queriesData, queryTemplateFunction) {
    $(queriesData).each(function (index, query) {
      var queryHTML = queryTemplateFunction(query);
      $queriesContainer.append($(queryHTML));
    });
  }

  function saveQuery() {
    var $textarea = $('textarea[name=q]');
    var query = $textarea.val();
    var $queryName = $('#save-query-name');
    var isPublic = $('#public-query').prop('checked');

    if (query.length) {
      $.ajax({
        method: 'GET',
        url:'djangoql-save-query/',
        data: { query: $textarea.val(), name: $queryName.val(), is_public: isPublic}
      }).done(function (data) {
        if ((typeof data.query_id !== 'undefined') && (typeof data.query_text !== 'undefined')) {
          selectedQuery.id = data.query_id;
          selectedQuery.text = data.query_text;
          $queryName.val('');
          refreshQueries(highlightQuery, [null, data.query_id]);
        }
      });
    } else {
      alert("Can't save empty query");
    }

    return false;
  }

  function deleteQuery(e) {
    var $target = $(e.target);
    var queryId = $target.parent().attr('query_id');

    if (confirm("Are you sure?")) {
      $.ajax({
        method: 'GET',
        url:'djangoql-delete-query/',
        data: { query_id: queryId}
      }).done(function () {
        refreshQueries(filterQueries);
      });
    }

    return false;
  }

  function selectQuery (e) {
    var $target = $(e.target);
    var text = $target.attr('query_text');

    updateSearchInput(text);
    highlightQuery($target);
    $('a.query').removeClass('changed-query');

    selectedQuery = {
      id: $target.attr('query_id'),
      text: text
    };

    return false;
  }

  function refreshQueries(callback, args) {
    $.ajax({url:'djangoql-query-list/'}).done(function(data) {
      var ownQueryData = data.own;
      var publicQueryData = data.public;
      var $queriesContainer = $('#queries');

      $queriesContainer.html('');
      populate($queriesContainer, ownQueryData, ownQueryTemplate);
      populate($queriesContainer, publicQueryData, publicQueryTemplate);

      $queriesContainer.unbind("click");
      $queriesContainer.on('click', 'a[query_id]', selectQuery);
      $queriesContainer.on('click', '.deleteQuery', deleteQuery);

      if (typeof callback !== 'undefined') {
        if (typeof args === 'undefined') args = [];
        callback.apply(null, args);
      }
    });
  }

  function markAsChanged($query) {
    var changedClass = 'changed-query';
    if (!$query.hasClass(changedClass)) {
      $query.addClass(changedClass);
    }
  }

  function checkSelectedQuyeryChanged() {
    if (selectedQuery.id) {
      var $textarea = $('textarea[name=q]');
      var $selectedQuery = $('a[query_id=' + selectedQuery.id + ']');
      if ($selectedQuery.attr('query_text') !== $textarea.val()) {
        markAsChanged($selectedQuery);
      }
    }
  }


  DjangoQL.DOMReady(function () {
    var $textarea = $('textarea[name=q]');
    $textarea.after($(
      '<div class="dropdown">' +
      '&nbsp;<span class="button" id="save-query-menu">🟊</span>' +
      '  <div id="querySaveMenu" class="dropdown-content">' +
      '    <input type="text" placeholder="Type to filter" class="dropdown-input" id="save-query-filter">' +
      '      <input type="text" placeholder="New query name" class="dropdown-name-input" id="save-query-name">' +
      '      <button class="button " href="#" id="save-query" disabled>Save</button>' +
      '      <input type="checkbox" class="" id="public-query"> public' +
      '      <hr>'+
      '    <div id="queries"></div>' +
      '  </div>' +
      '</div>'
    ));
    refreshQueries();
    $('#save-query').on('click', saveQuery);
    $('#save-query-filter').on('keyup', filterQueries);
    $('#save-query-name').on('keyup', checkSaveAvailability);
    $('#save-query-menu').on('click', toggleSaveMenu);
    $textarea.on('keyup', checkSelectedQuyeryChanged);
  });

}(window.DjangoQL));
