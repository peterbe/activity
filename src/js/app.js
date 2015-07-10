import React from 'react';

var SAMPLE_ITEMS = [
  {
    key: '2015-01-14-1',
    date: 'Apr 14',
    img: "http://www.gravatar.com/avatar/0c404ed91de8fafd91cf4b0ab4556a67.jpg?s=32",
    heading: "Richard Milewski",
    text: "Some text here"
  },
  {
    key: '2015-01-14-2',
    date: 'Apr 14',
    img: "http://www.gravatar.com/avatar/37d081c393f95a14e2704af38ecc4c8d.jpg?s=32",
    heading: "Peter Bengtsson",
    text: "Updated a <a href=\"https://bugzilla.mozilla.org/show_bug.cgi?id=1177635\">1177635</a>"
  },
  {
    key: '2015-01-11-1',
    date: 'Apr 11',
    img: "http://www.gravatar.com/avatar/0c404ed91de8fafd91cf4b0ab4556a67.jpg?s=32",
    heading: "Richard Milewski",
    text: "Other text now"
  }
];
// localStorage.setItem('activity', JSON.stringify({items:SAMPLE_ITEMS}));
// console.log(localStorage.getItem('activity'));

class FilteredList extends React.Component {
  // constructor(props) {
  //   super(props);
  constructor() {
    super();

    var store = JSON.parse(
      localStorage.getItem('activity') || '{"items": []}'
    );

    this.state = {
      initialItems: store.items,
      items: this.bucketThings(store.items),
    }

    // console.log('STORE', this.state.initialItems);
    // var items = this.bucketThings(this.state.initialItems);
    // this.setState({items: items});
    // console.log('ITEMS', items);
    // this.setState({
    //   initialItems: items,
    //   items: items
    // });
  }

  // getInitialState() {
  //   return {
  //     initialItems: [],  // all items
  //     items: []  // the displayed items
  //   }
  // }



  bucketThings(items) {
    var newItems = [];
    var lastDate = null;
    var things = [];
    items.forEach(function(item) {
      // console.log('COMPARE', item.date, lastDate);
      if (item.date !== lastDate && lastDate !== null) {
        // console.log('NEW BUCKET!');
        newItems.push({date: lastDate, things: things});
        things = [];
      }
      things.push(item);
      lastDate = item.date;
    });
    if (things.length) {
      // console.log('NEW BUCKET LASTLY!', lastDate);
      newItems.push({date: lastDate, things: things});
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
    this.setState({items: this.bucketThings(updatedList)});
  }

  render() {
    return (
      <div className="timeline">
        <input type="search" placeholder="Search filter"
         onChange={this.filterList.bind(this)}/>
        <List items={this.state.items}/>
      </div>
    );
  }
};


class List extends React.Component {
  renderThing(thing) {
    return [
      <div className="pull-left">
        <img className="events-object img-rounded" src={thing.img}/>
      </div>,
      <div className="events-body">
        <h4 className="events-heading">{thing.heading}</h4>
        <p>{thing.text}</p>
      </div>
    ]
  }

  render() {
    var left = true;
    return (
      <dl>
        {
        this.props.items.map(function(item) {
          left = !left;
          var pos = left ? 'pos-left' : 'pos-right';
          return [
              <dt>{item.date}</dt>,
              <dd className={pos +" clearfix"}>
                <div className="circ"></div>
                <div className="events">
                {
                  item.things.map(this.renderThing)
                }
                </div>
              </dd>
          ];
        }.bind(this))
      }
      </dl>
    )
  }
};


// var ListThings = React.createClass({
//   render: function() {
//     var pos = this.props.left ? 'pos-left' : 'pos-right';
//     //<dt>{this.props.item.date}</dt>,
//     return (
//
//       <dd className={pos +" clearfix"}>
//         <div className="circ"></div>
//         <div className="events">
//         {
//           this.props.item.things.map(function(thing) {
//             return [
//                 <div className="pull-left">
//                   <img className="events-object img-rounded" src={thing.img}/>
//                 </div>,
//                 <div className="events-body">
//                   <h4 className="events-heading">{thing.heading}</h4>
//                   <p>{thing.text}</p>
//                 </div>
//             ]
//           })
//         }
//         </div>
//       </dd>
//     )
//   }
// });


// var ListThings = React.createClass({
//   render: function() {
//     var pos = this.props.left ? 'pos-left' : 'pos-right';
//     return [
//       <dt>{this.props.item.date}</dt>,
//       <dd className={pos + " clearfix"}>
//         <div className="circ"></div>
//         <div className="events">
//           <div className="pull-left">
//             <img className="events-object img-rounded" src={this.props.item.img}/>
//           </div>
//           <div className="events-body">
//             <h4 className="events-heading">{this.props.item.heading}</h4>
//             <p>{this.props.item.text}</p>
//           </div>
//         </div>
//       </dd>
//     ]
//   }
// });
// var ListThings = React.createClass({
//   render: function() {
//     var pos = this.props.left ? 'pos-left' : 'pos-right';
//     return (
//
//       <dd className={pos + " clearfix"}>
//         <div className="circ"></div>
//         <div className="events">
//           <Thing item={this.props.item}/>
//         </div>
//       </dd>
//     )
//   }
// });
//
// var Thing = React.createClass({
//   render: function() {
//     return (
//       <div>
//       <div className="pull-left">
//         <img className="events-object img-rounded" src={this.props.item.img}/>
//       </div>,
//       <div className="events-body">
//         <h4 className="events-heading">{this.props.item.heading}</h4>
//         <p>{this.props.item.text}</p>
//       </div>
//       </div>
//     )
//   }
// });

React.render(<FilteredList/>, document.getElementById('mount-point'));

//
// var AddForm = React.createClass({
//   handleSubmit: function(e) {
//       e.preventDefault();
//       var heading = React.findDOMNode(this.refs.heading).value.trim();
//       var text = React.findDOMNode(this.refs.text).value.trim();
//       var email = React.findDOMNode(this.refs.email).value.trim();
//       if (heading && text && email) {
//         console.log(heading, text, email);
//       }
//   },
//   render: function() {
//     return (
//
//       <form className="row" onSubmit={this.handleSubmit}>
//         <div className="col-md-12">
//           <h2 className="example-title">Manually Add One</h2>
//           <div className="row">
//             <div className="col-md-6">
//               <input className="form-control" ref="heading" placeholder="Heading" type="text"/>
//             </div>
//           </div>
//           <div className="row">
//             <div className="col-md-6">
//               <textarea className="form-control" ref="text" placeholder="Text" rows="3"></textarea>
//             </div>
//           </div>
//           <div className="row">
//             <div className="col-md-6">
//               <input className="form-control" ref="email" placeholder="Email" type="email"/>
//             </div>
//           </div>
//           <div className="row">
//             <div className="col-md-6">
//               <button type="submit" className="btn btn-primary btn-block">Add</button>
//             </div>
//           </div>
//         </div>
//       </form>
//     )
//   }
// });
//
// React.render(<AddForm/>, document.getElementById('add-form'));
