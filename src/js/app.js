import React from 'react';

// var SAMPLE_ITEMS = [
//   {
//     key: '2015-01-14-1',
//     date: 'Apr 14',
//     img: "http://www.gravatar.com/avatar/0c404ed91de8fafd91cf4b0ab4556a67.jpg?s=32",
//     heading: "Richard Milewski",
//     text: "Some text here"
//   },
//   {
//     key: '2015-01-14-2',
//     date: 'Apr 14',
//     img: "http://www.gravatar.com/avatar/37d081c393f95a14e2704af38ecc4c8d.jpg?s=32",
//     heading: "Peter Bengtsson",
//     text: "Updated a <a href=\"https://bugzilla.mozilla.org/show_bug.cgi?id=1177635\">1177635</a>"
//   },
//   {
//     key: '2015-01-11-1',
//     date: 'Apr 11',
//     img: "http://www.gravatar.com/avatar/0c404ed91de8fafd91cf4b0ab4556a67.jpg?s=32",
//     heading: "Richard Milewski",
//     text: "Other text now"
//   }
// ];
// localStorage.setItem('activity', JSON.stringify({items:SAMPLE_ITEMS}));

class FilteredList extends React.Component {
  // constructor(props) {
  //   super(props);
  constructor() {
    super();

    // this is synchronous
    var store = JSON.parse(
      localStorage.getItem('activity') || '{"items": []}'
    );

    this.state = {
      day: null,
      initialItems: store.items,
      items: this.bucketThings(store.items, null),
    }
  }

  componentDidMount() {
    fetch('http://localhost:8000/events/airmozilla,socorro,kitsune,dxr')
      .then((response) => {
        return response.json()
      })
      .then((stuff) => {
        localStorage.setItem('activity', JSON.stringify(stuff));
        this.setState({
          initialItems: stuff.items,
          items: this.bucketThings(stuff.items, this.state.day)
        });
      })
      .catch((ex) => {
        alert(ex);
        console.log('parsing failed', ex)
      });
  }

  bucketThings(items, currentDate) {
    var newItems = [];
    var lastDate = null;
    var lastDay;
    var things = [];
    console.log('currentDate:', currentDate);
    var months = 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'.split(',');
    items.forEach((item) => {
      // We could parse the date and format it as "Apr 12" or something
      // console.log(new XDate(item.date));
      // console.log(new Date(item.date).getTime());
      var d = new Date(item.date);
      // day = ;
      // console.log(months[d.getMonth()]);
      // var date = item.date.split('T')[0];
      // console.log('DATE:',currentDate);
      var date = months[d.getMonth()] + ' ' + d.getDate();
      // var d = new Date(y,m,d);
      if (date !== lastDate && lastDate !== null) {
        newItems.push({date: lastDate, things: things, day: lastDay});
        things = [];
        // day = item.date.split('T')[0];
      }
      things.push(item);
      lastDate = date;
      lastDay = item.date.split('T')[0];
      // console.log(item.date, lastDay);

    });
    if (things.length) {
      // console.log('Lastly', lastDay);
      newItems.push({date: lastDate, things: things, day: lastDay});
    }
    // console.log('newItems', newItems);
    return newItems;
  }

  filterList(event) {
    var updatedList = this.state.initialItems;

    var term = event.target.value.toLowerCase().trim();
    if (term) {
      updatedList = updatedList.filter(function(item){
        // OR statements much?!
        if (item.date.toLowerCase().search(term) > -1) {
          return true;
        }
        if (item.heading.toLowerCase().search(term) > -1) {
          return true;
        }
        if (item.text.toLowerCase().search(term) > -1) {
          return true;
        }
        return false;
      });
    }
    this.setState({items: this.bucketThings(updatedList, this.day)});
  }

  handleClickDate(e) {
    // console.log('E', e.target.dataset.day);
    var day = e.target.dataset.day;
    // console.log(this.state);
    var updatedList = this.state.initialItems;
    updatedList = updatedList.filter((item) => {
      console.log('Filter', item.date, day, item.date.substring(0, day.length) === day);
      // return true;
      return item.date.substring(0, day.length) === day;
      // return group.day === day;
      // if (item.date.substring(0, ))
      // return false;
    })
    console.log('updatedList', updatedList);

    this.setState({items: this.bucketThings(updatedList, day), day: day});
  }

  render() {
    return (
      <div className="timeline">
        <input type="search" placeholder="Search filter"
         onChange={this.filterList.bind(this)}/>
        <div>Date: {this.state.day}</div>
        <List onclick={this.handleClickDate.bind(this)} items={this.state.items}/>
      </div>
    );
  }
};


class List extends React.Component {

  simplifyThing(thing) {
    // console.log("THING", thing);
    thing.heading = thing.person.name ||
                    thing.person.github ||
                    thing.person.bugzilla ||
                    thing.person.irc ||
                    thing.person.email;
    switch (thing.type) {
      case 'bugzilla-comment':
        thing.text = 'Bugzilla Comment<br>';
        thing.text += `<a href="${thing.url}"
          title="${thing.meta.text}"><b>${thing.meta.id}</b> ${thing.meta.summary}</a>`;
        // console.log(thing);
        break;
      case 'bugzilla-bug':
        thing.text = 'Bugzilla Bug<br>';
        thing.text += `<a href="${thing.url}"><b>${thing.meta.id}</b> ${thing.meta.summary}</a>`;
        break;
      case 'github':
        thing.text = 'GitHub ' + thing.meta.type;
        switch (thing.meta.type) {
          case 'PushEvent':
            thing.text = 'GitHub Push<br>'
            if (thing.meta.commits) {
              thing.meta.commits.forEach((commit) => {
                thing.text += `<a href="${commit.url}">${commit.message}</a><br>`;
              });
            }
            break;
          case 'PullRequestEvent':
            thing.text = 'GitHub Pull Request<br>'
            if (thing.meta.title) {
              thing.text += `<a href="${thing.url}">${thing.meta.title}</a>`;
            } else {
              thing.text += `<a href="${thing.url}">URL</a>`;
            }
            break;
          case 'IssueCommentEvent':
            thing.text = 'GitHub Issue Comment<br>'
            if (thing.meta.issue && thing.meta.issue.title) {
              thing.text += `<a href="${thing.url}">${thing.meta.issue.title}</a>`;
            } else {
              thing.text += `<a href="${thing.url}"><i>No title</i></a>`;
            }

            break;
          case 'PullRequestReviewCommentEvent':
            thing.text = 'GitHub Pull Request Comment<br>';
            if (thing.meta.pull_request && thing.meta.pull_request.title) {
              thing.text += `<a href="${thing.url}">${thing.meta.pull_request.title}</a>`;
            } else {
              thing.text += `<a href="${thing.url}"><i>No title</i></a>`;
            }
            break;
          case 'CreateEvent':
            thing.text = 'GitHub<br>';
            if (thing.meta.tag) {
              thing.text += `<a href="${thing.url}">Create tag ${thing.meta.tag}</a>`;
            } else {
              thing.text += `<a href="${thing.url}">Create something</a>`;
            }
            break;
          default:
            console.log('What about', thing.meta.type, thing.url);
            console.log(thing.meta)
            thing.text = 'GitHub';
        }
      break;

      default:
        thing.text = thing.type;
    }
    // thing.heading = thing.type;
    if (thing.img) {
      if (thing.img.charAt(thing.img.length - 1) === '?') {
        thing.img += 's=32';
      }
    }
  }

  renderThing(thing) {
    this.simplifyThing(thing);

    return [
      <div className="pull-left">
        <img className="events-object img-rounded" src={thing.img} width="32"/>
      </div>,
      <div className="events-body">
        <h4 className="events-heading">
          {thing.heading}
        </h4>
        <p dangerouslySetInnerHTML={{__html: thing.text}}>
        </p>
      </div>
    ]
  }

  // handleClickDate(e) {
  //   console.log('clicked date', e.target.dataset.day, this);
  //   // this.setState({day: e.target.dataset.day});
  //
  // }

  render() {
    var left = true;
    // var thisDate = this.state.date;
    // console.log('Render', this.props);
    // this.props.onclick('Foo');
    return (
      <dl>
        {
        this.props.items.map((item) => {
          left = !left;
          var pos = left ? 'pos-left' : 'pos-right';
          // var dateHeader = <dt title="123 days ago" data-day={item.day}
          // >{item.date}</dt>
          var dateHeader = <dt title="123 days ago" data-day={item.day}
            onClick={this.props.onclick}>{item.date}</dt>
          return [
              dateHeader,
              <dd className={pos +" clearfix"}>
                <div className="circ"></div>
                <div className="events">
                {
                  item.things.map(this.renderThing.bind(this))
                }
                </div>
              </dd>
          ];
        })
      }
      </dl>
    )
  }
};

React.render(<FilteredList/>, document.getElementById('mount-point'));
