jQuery-Sequence
===============

Create sequences of asynchrous/synchronous/anything calls that are guaranteed to run in order. By using promises, we
remove the callback nesting craziness.

We can handle any sort of callback structure (callback is first, last, or even inside a hash like jQuery.fn.animate).
We can also read in results of previous step anywhere into the next method's arguments.

*   [Install](#install)
*   [Basics](#basics)
*   [Error Handling](#error-handling)
*   [Advanced](#advanced)
    *   [Position the callback](#position-the-callback)
    *   [Nested callbacks](#nested-callbacks)
    *   [Declaring the scope](#declaring-the-scope)
    *   [Register/Run](#registerrun-register-once-run-a-bunch)
    *   [Error callbacks](#error-callbacks)
*   [API](#api)
    *   [Placeholders](#placeholders)
        *   [Sequence.CB](#sequencecb)
        *   [Sequence.PREV](#sequenceprev)
        *   [Sequence.ERR](#sequenceerr)
    *   [Static Utilities](#static-utilities)
        *   [Sequence.start()] (#sequencestart)
    *   [Methods](#methods)
        *   [end()](#end)
        *   [handle()](#handle)
        *   [register()](#register)
        *   [then()](#then)
        *   [wait()](#wait)
        *   [wrap()](#wrap)
*   [License](#license)

Install
-------

Download, include in page, and enjoy!

The basic scaffold:

```html
<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
<script type="text/javascript" src="jquery.sequence.js"></script>
<script type="text/javascript">
jQuery(function($) {
    // create a new sequence
    $.Sequence.start()

        // call a function that takes a callback
        .handle(...)

        // pause for a moment before continuing
        .wait(...)

        // wrap anything with a return value (if it returns a promise, then we wait for it)
        .wrap(...)

        // end the sequence and get a promise
        .end()

        // read the results (http://api.jquery.com/category/deferred-object/)
        .done(...)            // success
        .fail(...)            // errors
        .then(done, fail)     // does both at once
        .always(...)          // runs no matter what (i.e. finally clause)
});
</script>
```

Basics
-------

Okay, now some simple but real examples

```html
/** a function with a callback */
function doCallback(callback, a, b, wait) {
    setTimeout( function(){ callback(a + b); }, wait );
}

/** a promise return value */
function doMathLater(a, b) {
    var deferred = $.Deferred();
    setTimeout( function() { deferred.resolve(a + b); }, 250 );
    return deferred.promise();
}

/** a vanilla return value */
function doMathNow(a, b) {
    return a + b;
}


// create a new sequence
$.Sequence.start()
    // wait 100 milliseconds, then execute the callback with '3'
    .handle(doCallback, 1, 2, 100) // return value is now 3 (1+2)

    // pause 100 milliseconds
    .wait(100) // return value is still 3

    // get the previous returned value (3), and pass it to a method which returns
    // a promise and eventually gets around to adding the values
    .wrap(doMathLater, Sequence.PREV, 2) // return value is now 5 (3+2)

    // get the previous value (5) and do math on it immediately (after resolving previous step of course)
    .wrap(doMathNow, Sequence.PREV, 3)   // return value is now 8 (5+3)

    // end the sequence and get a promise
    .end()

    // read the results (http://api.jquery.com/category/deferred-object/)
    .done(...)            // success
    .fail(...)            // errors
    .then(done, fail)     // does both at once
    .always(...)          // runs no matter what (i.e. finally clause)
```

Error handling
--------------

Error handling is pretty much magical. If an error is returned, thrown, or passed into the callback, then the chain
is immediately broken (no more steps get run) and the values thus far are passed to the promise
methods (i.e. done/fail/then/always).

Examples:

```javascript
// throw an error
$.Sequence.start()
    .wrap(function() { return 'hello'; })
    .wrap(function() { throw new Error('oops'); })
    .wrap(function() { return 'goodbye'; }) // not invoked
    .end()
    .then(
        function() {...}, // not invoked
        function() {...}  // ['hello', Error('oops')]
    )
    .done(...)   // not invoked
    .fail(...)   // ['hello', Error('oops')]
    .always(...) // ['hello', Error('oops')]

// return an error
$.Sequence.start()
    .wrap(function() { return new Error('oops'); })
    .end()
    .then(
        function() {...}, // not invoked
        function() {...}  // [ Error('oops') ]
    )
    .done(...)   // not invoked
    .fail(...)   // [ Error('oops') ]
    .always(...) // [ Error('oops') ]

// pass error to a callback
$.Sequence.start()
    .handle(function(callback) { callback(new Error('oops')); })
    .end()
    .then(
        function() {...}, // not invoked
        function() {...}  // [ Error('oops') ]
    )
    .done(...)   // not invoked
    .fail(...)   // [ Error('oops') ]
    .always(...) // [ Error('oops') ]
```

Advanced
--------

### Position the callback

That's good and fine, you say, but what about when the callback is the third argument?

If you don't tell Sequence where the callback is, it's assumed to be first. You can tell Sequence where to put it
with `Sequence.CB`. You can also get extra fancy by passing options before the function.

```javascript
// initiate a Sequence
$.Sequence.start()

    // put the callback second
    .wrap( function, first_argument, Sequence.CB, third_argument )

    // put the callback last
    .wrap( function, first_arg, second_arg, Sequence.CB )

    // splice the callback into the arguments using the props object
    .handle( {cbPos: 1}, function, argument_one, /* callback */ third_argument )
```

### Nested callbacks inside hash/object/array

Okay, but what if it's inside an object? Simple, just pass some arguments before the function.

```javascript
// initiate a Sequence
$.Sequence.start()

    // insert the callback into an array
    .handle( {cbPos: 0, cbKey: 2}, function, [arg_one, arg_two /* callback */ ] )

    // insert the callback into an object
    .handle( {cbPos: 0, cbKey: 'success'}, function, {speed: 100, /* success: callback */ } );
```

### Declaring the scope (i.e. `this` inside the calls)

What if I want to call a method with a `this` scope? Simply put the scope first

```javascript
var scope = new Widget();

// initiate a Sequence
$.Sequence.start()

    // declare scope for the function call (inside function, `this` refers to Widget instance)
    .handle( scope, function, args... )

    // declare scope and use the options hash (scope goes first)
    .handle( scope, {...}, function, args... )

```

### Register/Run (register once, run a bunch)

Okay, that works, but it's tedious to pass that stuff every time I call it.

We couldn't agree more. DRY is KISSable.

```javascript
// create a function to register
function buildWidget(type, name, callback) {
    callback(new Widget(type, name));
}

// initiate a sequence
$.Sequence.start()

    // declare a function we want to run repeatedly
    .register( {cbPos: 2, defaults: ['generic', 'anonymous'] }, 'make', buildWidget )

    // now build a bunch of widgets! yay!
    .run( 'make' )                        // new Widget('generic', 'anonymous')
    .run( 'make', 'electric' )            // new Widget('electric', 'anonymous')
    .run( 'make', 'gas powered', 'Ford' ) // new Widget('gas powered', 'Ford')
    .run( 'make', null, 'GMC' )           // new Widget('generic', 'GMC')
```

### Error callbacks

But my function also has an error callback separate from the success callback?

That's fine, just use the `Sequence.ERR` placeholder or put some mojo into the options.

```javascript
// create a new sequence
$.Sequence.start()

    .handle( function, Sequence.ERR, arg1, arg2 )         // function( successCallback, errorCallback, arg1, arg2 )
    .handle( function, arg1, Sequence.CB, Sequence.ERR )  // function( arg1, successCallback, errorCallback )
    .handle( {cbPos: 2, errPos: 1}, function, arg1 )      // function( arg1, errorCallback, successCallback )

    // function( {args: [arg1], success: successCallback, fail: errorCallback} )
    .handle( {cbPos: 0, cbKey: 'success', errPos: 0, errKey: 'fail'}, function, {args: [arg1]} )
```

API
---

## Placeholders

### `Sequence.CB`
Represents the position of the callback method. For calls to handle(), if this is not specified, it's assumed to
be the first argument.

### `Sequence.PREV`
Represents the position to insert return value from previous step. If this is the first step, this will be undefined.

### `Sequence.ERR`
Represents the position for an error callback. For calls to handle(), if this is not specified, then no error callback
is added.

## Static Utilities

### Sequence.start()

This is essentially the same as calling `new $.Sequence()`, just a little syntactically cleaner than `(new $.Sequence()).wrap(...)`

## Methods

### end()

> `void end()`<br />
> @return {[jQuery.Deferred](http://api.jquery.com/category/deferred-object/)} a promise with then/done/fail/always methods

Complete all steps and return a promise which will resolve with all the return values from each step.

After calling this method, no more steps may be added with wrap/handle/run methods. Once all existing steps
resolve, the promise returned by this method will return all results from all steps in an array.

If the sequence is broken, an array is still returned, containing all results up to the breaking step, with
the final value as the rejected error value.

Note that the steps of the sequence will complete and resolve without calling this method. It is only necessary
in order to retrieve all the results from each step.

```javascript
   Sequence.start()
      .wrap(function() { return 'hello'; })
      .wrap(function() { return 'goodbye'; })
      .end()
      .then(
         function() {...},          // ["hello", "goodbye"]
         function() {...}           // does not get invoked (no error condition)
      )
      .done(...)                    // ["hello", "goodbye"]
      .fail(function(e) { ... }     // does not get invoked (no error condition)
      .always(function(v) { ... }   // ["hello", "goodbye"]
```


### handle()

> `Sequence handle( [scope], [opts], fx, [args...] )<br />
> @param `scope` {Object} set the `this` instance inside of fx<br />
> @param `opts` {object} a hash containing options for the fx call (see details below)<br />
> @param `fx` {function} the function to be executed, which must accept a callback<br />
> @param `args` zero or more arguments passed to `fx` when it is invoked<br />
> @return {Sequence}

Call `fx`, which represents any function that invokes a callback on completion. Any number of arguments may be passed to `fx` by simply including them after the function to be executed.

This is intended for single uses. To call methods repeatedly, check out register() and run().

The special constant Sequence.CB is used to specify where in the arguments the callback should appear. If it is not found, then the callback is placed first. Examples:

```javascript
   Sequence.start()
      .handle( fx );                    // fx( callback )
      .handle( fx, Sequence.CB, 'a', 'b' ) // fx( callback, 'a', 'b' )
      .handle( fx, 'a', 'b' )           // fx( 'a', 'b', callback )
      .handle( fx, 'a', Sequence.CB, 'b' ) // fx( 'a', callback, 'b' )
```

If `scope` is provided, then inside fx, `this` will refer to scope.

```javascript
   function Color(c) { this.color = c; }
   var col   = new Color('red');
   var sequence = new Sequence();

   Sequence.start().handle(col, function(callback) {
      callback(this.color); // 'red'
   });
```

The return value of any previous step in the sequence can be accessed using the placeholder Sequence.PREV, which behaves
much like Sequence.CB. Unlike Sequence.CB, it must exist and there is no default behavior if it is not included.

Examples:

```javascript
   // a simple callback structure
   function add(callback, base, amt) {
      setTimeout( function() { callback( base + amt ); }, 100 );
   }

   // something with a little more configuration
   function subtract(amt, from, callback) {
      setTimeout( function() { callback( from - amt ); }, 200 );
   }

   (new Sequence())
      .handle( add, 0, 1 );                        // 1
      .handle( add, Sequence.PREV, 1 )                // 2
      .handle( add, Sequence.PREV, 3 )                // 5
      .handle( subtract, 1, Sequence.PREV, Sequence.CB ) // 4
      .handle( subtract, 3, Sequence.PREV, Sequence.CB ) // 1
      .end()
      .done(...);                                  // [1, 2, 5, 4, 1]
```

Instead of using Sequence.CB as a placeholder, we can also splice the callback in, or drop it into an
existing argument using the following keys in `opts`.

Likewise, instead of using Sequence.PREV as a placeholder, we can also splice the return value in, or drop it
into an existing argument using the following keys in `opts`.

The special `defaults` array can override any undefined arguments passed in.

Last but not least, some methods include a success callback and an error callback. The special placeholder
Sequence.ERR can be used to insert an error callback into the arguments. And, of course, it can be specified in
`opts`:

All possible keys in the `opts` hash:
<ul>
   <li>{int}        prevPos   which position will return value be spliced into? 0 represents the first
                              argument passed to `fx`</li>
   <li>{int|string} prevKey   instead of splicing return value into args, insert it into existing
                              object/array at `cbPos`</li>
   <li>{int}        cbPos     which position will the callback be spliced into? 0 represents the first
                              argument passed to `fx`</li>
   <li>{int|string} cbKey     instead of splicing callback into args, insert it into existing object/array
                              at `cbPos`</li>
   <li>{array}      defaults  any undefined|null argument is replaced with the default; this can also be used for
                              prev step's return value on the first iteration (i.e. when there is no previous step)</li>
   <li>{int}        errPos   which position will the error callback be spliced into? 0 represents the first argument passed to `fx`</li>
   <li>{int|string} errKey   instead of splicing error callback into args, insert it into existing object/array at `cbPos`</li>
</ul>

Examples:

```javascript
   function goToDisneyland( numberOfPeople, date, callback ) {
      var cost = 20.00;
      var dateString = date.toString('MM/dd/YYYY');
      callback( "Taking "+numberOfPeople+" to Disneyland on "+dateString+" will cost $"+(numberOfPeople*cost) );
   }

   function goHome( opts ) {
      opts.callback( opts.message );
   }

   function goToStore( callback, opts ) {
      callback( opts[0] + opts[1] );
   }

   // splice callback and return value into arguments via the `opts` config parms
   Sequence.start()
      .wrap(function() { return new Date(2999, 01, 01) }) // get a return value to use in our example
      .handle( {cbPos: 2, prevPos: 1}, goToDisneyland, 10 )
      .end().done( alert ); // alerts: "Taking 10 people to Disneyland on 01/01/2999 will cost $200"

   // put callback into an existing object
   Sequence.start().handle( {cbPos: 0, cbKey: callback}, goHome, {message: 'I am tired'} )
        .then(...); // 'I am tired'

   // put return value into an existing array
   Sequence.start()
        .wrap( function() {return '$20.00'} )
        .handle( {prevPos: 1, prevKey: 1}, goToStore, ['I have '] )
        .then(...); // 'I have $20.00'
```

Note that, in the case of an array, a new index is spliced into the array (there is no placeholder)

### register()

> `Sequence register( fxName, fx, [opts] )<br />
> @param `fxName` {string} alias for the function that will be used with `run` to call it later<br />
> @param `fx` {function} the function to be executed whenever `run(fxName)` is invoked<br />
> @param `opts` {object} a hash containing config properties (see below)<br />
> @return {Sequence}

Register a method which may then be executed multiple times by calling `run`

The `opts` hash may contain any of the following:
   - {int}        cbPos     if specified, a callback is spliced into the arguments at this position
   - {string|int} cbKey     if specified, this alters the behavior of `cbPos`;
                            the callback is added into an object/array instead of spliced into args
   - {int}        prevPos   if specified, the return value of previous function in sequence is spliced into args at this position
   - {string|int} prevKey   if specified, this alters the behavior of `prevPos`;
                            the return value is added into an object/array instead of spliced into args
   - {int}        errPos    if specified, an error callback is spliced into args at this position
   - {string|int} errKey    if specified, inserts error callback into object/array at errPos instead of splicing it
   - {array}      defaults  any undefined|null argument is replaced with the default; this can also be used for
                            prev step's return value on the first iteration (i.e. when there is no previous step)

If cbPos is not specified, then run() will behave just like the wrap() method (using the return value). Otherwise,
run() will behave like the handle() method (expecting a callback to be invoked).

The `errPos` and `errKey` options are only utilized if cbPos exists (we must declare a success callback if a
callback is to be used, otherwise, only the return value is evaluated).

If an Error is thrown or the return value is an instance of Error, then the chain is broken immediately and error
handlers are notified.

Examples:

```javascript
  function TestScope() {
     this.multiply = function(callback, a, b) {
        setTimeout( function() { callback( a * b ); }, 100 );
     }
  }
  var testScope = new TestScope();

  Sequence.start()
     // register some functions
     .register( 'add', function(a, b) { return a + b; }, { defaults: [ 0, 1 ], prevPos: 0 } )
     .register( 'sum',
        function(callback, a, b) { return this.multiply(callback, a, b); },
        { cbPos: 0, prevPos: 2 } )

     // now run them a bunch
     .run('add')               // 1  ( default=0,     default=1 )
     .run('add', 3)            // 4  ( returnValue=1, arg=3 )
     .run('add')               // 5  ( returnValue=4, default=1 )

     .run(testScope, 'sum', 5) // 25 ( returnValue=5, arg=5 )
     .end()
     .done(function(v) { console.log('done', v); })
     .fail(function(e) { console.error('fail() should not run', e); })
     .always(function(v) {
        console.log('always', v);
        next();
     });
```

### run()

> `Sequence run( [scope], fxName, [args...] )`<br />
> @param `scope`: {Object} set the `this` instance inside of `fx`<br />
> @param `fx` {function} the function to be executed whenever `run(fxName)` is invoked<br />
> @param `args` any number of arguments to pass into `fx` when it is invoked<br />
> @return {Sequence}

Run any function added with `register` (see register() for examples and details)


### then()

> `Sequence then( fx [, errorFxn] )<br />
> @param `fx` {function} the function to invoke when previous step completes<br />
> @param `errorFxn` {function} called if the previous step fails with error condition<br />
> @return {Sequence}

Get the results of the previous step from sequence (once it resolves) and do something with it outside of the sequence.

This is a method of obtaining a single result from the sequence rather than waiting for the entire sequence to complete. This call is not part of the sequence and the return value is ignored. Async calls within these functions do not delay execution of the next step.

Exceptions thrown by `fx` are caught, since they would prevent end/done/fail/always from being invoked. However, they are discarded silently, so do not attempt to use then() to do anything that should break the sequence if it fails.

Examples:

```javascript
   Sequence.start()
        .wrap( function() { return true; } )
        .then(...)                             // 'true'
        .then( function() { return false; } )  // return value is ignored
        .then(...)                             // 'true'

        .then( function() {
            throw new Error('oops');            // this is caught and discarded
        })

        .wrap( ... )                            // this gets run
        .handle( ... )                          // this gets run
        .done( ... )                            // this gets run

        .fail( ... );                           // this does not get invoked
```

Just like jQuery.Deferred, then() accepts an error handler as well:

```javascript
   function resolve() { alert('success'); }
   function reject()  { alert('failed'); }

   Sequence.start()
        .wrap( function() { return true; })
        .then( resolve, reject ) // 'success'

        .wrap( function() { throw new Error('oops'); })
        .then( resolve, reject ); // 'failed'

        // final results
        .done( ... ) // 'true'
        .fail( ... ) // never called!
```

### wait()

> `Sequence wait( howlong )`<br />
> @param `howlong` {int} milliseconds<br />
> @return {Sequence}

Wait a specified length before invoking the next step of the sequence (just a good ole fashion sleep() method).

This does not add any values to the array of results received after end() is called. The result of the previous step is passed on to the next step as if wait() wasn't in the middle.

### wrap()

> `Sequence wrap( [scope], [opts], fx, [args...] )`<br />
> @param `scope` {Object} set the `this` instance inside of fx<br />
> @param `opts` {object} a hash containing options for the fx call (see description above)<br />
> @param `fx` {function} the function to be executed, which may return a value<br />
> @param `args` zero or more arguments passed to `fx` when it is invoked<br />
> @return {Sequence}

Wrap `fx`, which returns a value instead of invoking a callback, and continue the sequence. Any number of arguments
may be passed after `fx`, which are passed to the method when it is invoked.

If `fk` returns a jQuery.Deferred.promise() object, then it will be resolved before the sequence continues. Any other
value is treated as already resolved and we continue immediately. If `fx` throws or returns an error, then
the chain is broken (fail() listeners are called, done() listeners are never notified)

The return value of any previous step in the sequence can be accessed using the placeholder Sequence.PREV.

Examples:

```javascript
   // returns a + b for fun and profit
   function add(a, b) {
      return a+b;
   }

   // returns a promise object that will add a + b at some time in the future
   function promise(a, b) {
      var def = $.Deferred();
      setTimeout(function() {
         def.resolve(a + b); // but gets added later
      }, 500);
      return def.promise(); // returns immediately
   }

   (new Sequence())
      .wrap( add, 0, 1 );             // 1
      .wrap( add, Sequence.PREV, 1 )     // 2
      .wrap( add, Sequence.PREV, 3 )     // 5
      .wrap( promise, Sequence.PREV, 1 ) // 6
      .wrap( promise, Sequence.PREV, 2 ) // 8
      .end()
      .done(...);                     // [1, 2, 5, 6, 8]
```

Instead of using Sequence.PREV as a placeholder, we can also splice the return value in, or drop it into
an existing argument using the following keys in `opts`:
<ul>
   <li>{int}        prevPos   which position will return value be spliced into?
                              0 represents the first argument passed to `fx`</li>
   <li>{int|string} prevKey   instead of splicing return value into args,
                              insert it into existing object/array at `cbPos`</li>
</ul>

Examples:

```javascript
   function goToDisneyland( numberOfPeople, date ) {
      var cost = 20.00;
      return "Taking "+numberOfPeople+" to Disneyland on "+date+" will cost $"+(numberOfPeople*cost);
   }

   // splice callback and return value into arguments via the `opts` config parms
   Sequence.start()
      .wrap(function() { return '01/01/2999' }) // a date to pass to the next step
      .wrap( {prevPos: 1}, goToDisneyland, 10 ) // inserts prev steps result at pos 1 (after 10)
      .then(...);                               // "Taking 10 people to Disneyland on 01/01/2999 will cost $200"
```

License
-------
License
(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.