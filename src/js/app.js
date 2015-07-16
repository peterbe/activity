import React from 'react';

const months = 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec'.split(',');

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
    return;
    fetch('http://localhost:8000/events/airmozilla,socorro')
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
        console.log('parsing failed', ex);
      });
  }

  bucketThings(items, currentDate) {
    var newItems = [];
    var lastDate = null;
    var lastDay;
    var things = [];
    // console.log('currentDate:', currentDate);

    items.forEach((item) => {
      var d = new Date(item.date);
      var date;
      if (currentDate === null) {
        date = months[d.getMonth()] + ' ' + d.getDate();
      } else {
        let hours = d.getHours();
        let ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12;
        date = hours + ampm;
      }
      if (date !== lastDate && lastDate !== null) {
        newItems.push({date: lastDate, things: things, day: lastDay});
        things = [];
      }
      things.push(item);
      lastDate = date;
      lastDay = [d.getFullYear(), d.getMonth(), d.getDate()];
    });
    if (things.length) {
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
    // console.log('E', e.target.dataset);
    var day = [
      parseInt(e.target.dataset.dayYear, 10),
      parseInt(e.target.dataset.dayMonth, 10),
      parseInt(e.target.dataset.dayDate, 10)
    ];
    // console.log('DAY', day);
    // console.log(this.state);
    var updatedList = this.state.initialItems;
    updatedList = updatedList.filter((item) => {
      var d = new Date(item.date);
      return d.getFullYear() == day[0] && d.getMonth() == day[1] && d.getDate() == day[2];
    })
    this.setState({items: this.bucketThings(updatedList, day), day: day});
  }

  handleDayButtonClick(e) {
    e.preventDefault();
    this.setState({items: this.bucketThings(this.state.initialItems, null), day: null});
  }

  render() {
    return (
      <div className="timeline">
        <input type="search" placeholder="Search filter"
         className={this.state.day ? 'with-day-button' : ''}
         onChange={this.filterList.bind(this)}/>
         <Day day={this.state.day} onclick={this.handleDayButtonClick.bind(this)}/>
        <List onclick={this.handleClickDate.bind(this)} items={this.state.items}/>
      </div>
    );
  }
};


class Day extends React.Component {
  render() {
    console.log(this.props);
    if (this.props.day) {
      let month = months[this.props.day[1]];
      let text = this.props.day[2] + ' ' + month + ' ' + this.props.day[0];
      return <button type="button" className="btn btn-primary"
        onClick={this.props.onclick}>{text}</button>
    } else {
      return <div></div>
    }

  }
}

class List extends React.Component {

  simplifyThing(thing) {
    // console.log("THING", thing);
    thing.heading = thing.person.name ||
                    thing.person.github ||
                    thing.person.bugzilla ||
                    thing.person.irc ||
                    thing.person.email;

    thing.text = '';
    switch (thing.type) {
      case 'bugzilla-comment':
        thing.text += 'Bugzilla Comment<br>';
        thing.text += `<a href="${thing.url}"
          title="${thing.meta.text}"><b>${thing.meta.id}</b> ${thing.meta.summary}</a>`;
        // console.log(thing);
        break;
      case 'bugzilla-bug':
        thing.text += 'Bugzilla Bug<br>';
        thing.text += `<a href="${thing.url}"><b>${thing.meta.id}</b> ${thing.meta.summary}</a>`;
        break;
      case 'github':

        switch (thing.meta.type) {
          case 'PushEvent':
            thing.text += 'GitHub Push<br>'
            if (thing.meta.commits) {
              thing.meta.commits.forEach((commit) => {
                thing.text += `<a href="${commit.url}"
                  title="${commit.message}">${commit.message}</a><br>`;
              });
            }
            break;
          case 'PullRequestEvent':
            thing.text += 'GitHub Pull Request<br>'
            if (thing.meta.title) {
              thing.text += `<a href="${thing.url}"
                title="${thing.meta.title}">${thing.meta.title}</a>`;
            } else {
              thing.text += `<a href="${thing.url}">URL</a>`;
            }
            break;
          case 'IssueCommentEvent':
            thing.text += 'GitHub Issue Comment<br>'
            if (thing.meta.issue && thing.meta.issue.title) {
              thing.text += `<a href="${thing.url}"
                title="${thing.meta.issue.title}">${thing.meta.issue.title}</a>`;
            } else {
              thing.text += `<a href="${thing.url}"><i>No title</i></a>`;
            }

            break;
          case 'PullRequestReviewCommentEvent':
            thing.text += 'GitHub Pull Request Comment<br>';
            if (thing.meta.pull_request && thing.meta.pull_request.title) {
              thing.text += `<a href="${thing.url}">${thing.meta.pull_request.title}</a>`;
            } else {
              thing.text += `<a href="${thing.url}"><i>No title</i></a>`;
            }
            break;
          case 'CreateEvent':
            thing.text += 'GitHub<br>';
            if (thing.meta.tag) {
              thing.text += `<a href="${thing.url}">Create tag ${thing.meta.tag}</a>`;
            } else {
              thing.text += `<a href="${thing.url}">Create something</a>`;
            }
            break;
          default:
            console.log('What about', thing.meta.type, thing.url);
            console.log(thing.meta)
            thing.text += 'GitHub';

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
          <a className="project" href={thing.project.url}>{thing.project.name}</a>
        </h4>
        <p dangerouslySetInnerHTML={{__html: thing.text}}>
        </p>
      </div>
    ]
  }

  render() {
    var left = true;
    return (
      <dl>
        {
        this.props.items.map((item) => {
          left = !left;
          var pos = left ? 'pos-left' : 'pos-right';
          // var dateHeader = <dt title="123 days ago" data-day={item.day}
          // >{item.date}</dt>
          var dateHeader = <dt title="123 days ago"
            data-day-year={item.day[0]}
            data-day-month={item.day[1]}
            data-day-date={item.day[2]}
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
