jQuery-Sequence
===============

Create sequences of asynchrous/synchronous/anything calls that are guaranteed to run in order. By using promises, we
remove the callback nesting craziness.

We can handle any sort of callback structure (callback is first, last, or even inside a hash like jQuery.fn.animate).
We can also read in results of previous step anywhere into the next method's arguments.

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

# Placeholders

*`Sequence.CB`*
Represents the position of the callback method. For calls to handle(), if this is not specified, it's assumed to
be the first argument.

*`Sequence.PREV`*
Represents the position to insert return value from previous step. If this is the first step, this will be undefined.

*`Sequence.ERR`*
Represents the position for an error callback. For calls to handle(), if this is not specified, then no error callback
is added.

# Static Utilities

### Sequence.start()

This is essentially the same as calling `new $.Sequence()`, just a little syntactically cleaner than `(new $.Sequence()).wrap(...)`

# Methods

### end()

### handle()

### register()

### run()

### then()

### wait()

### wrap()
