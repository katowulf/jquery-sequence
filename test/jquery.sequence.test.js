jQuery(function($) {

   var S = $.Sequence;

   if( !(typeof Object.keys == 'function') ) {
      Object.keys = function( obj ) {
         var array = new Array();
         for ( var prop in obj ) {
            if ( obj.hasOwnProperty( prop ) ) {
               array.push( prop );
            }
         }
         return array;
      };
   }

   module("$.Sequence Test Cases");

   /******************************************
    Sequence::start()
    ******************************************/

   asyncTest('Sequence::start()', function() {
      expect(3);
      var seq;

      // call start vanilla
      seq = S.start();
      ok(seq instanceof S, 'Should be instance of $.Sequence');

      // call start and register some functions
      seq = S.start({ callA: function(){return 'A';}, callB: {fx: function(cb){ cb('B');}, cbPos: 0} });

      // make sure the functions were registered
      // since wait() is automagically registered, count is +1
      equal(Object.keys(seq.fxns).length, 3, 'S.start() should register 2 functions');
      seq.callA()
         .callB()
         .end()
         .done(shouldCall)
         .fail(shouldNotCall) // should run without any errors
         .always(start);
   });

   /******************************************
    Sequence#handle()
    ******************************************/

   test('#handle - vanilla', function() {
      expect(2);
      S.start().handle(function(cb) { cb(true); })
            .then(thenFx(true))
            .end()
            .done(function(v) {
               deepEqual(v, [true], 'done() function should get array with callback value');
            })
            .fail(shouldNotCall);
   });

   test('#handle - specify callback in various ways', function() {
      expect(17);

      // simple callback splice at pos 1
      function fx1(a, cb, c) {
         ok( (typeof cb === 'function'), 'Callback should be a function');
         cb(a, c);
      }
      S.start().handle({cbPos: 1}, fx1, 'A', 'C')
            .then(thenFx('A', 'C'))
            .end()
            .done(function(v) {
               deepEqual(v, [['A', 'C']], 'done() function should get array with callback values');
            })
            .fail(shouldNotCall);

      // put callback into array
      function fx2(vals) {
         ok( Array.isArray(vals), 'argument should be an array');
         equal( (typeof vals[1]), 'function', 'callback key should contain a function');
         vals[1](vals[0], vals[2]);
      }
      S.start().handle({cbPos: 0, cbKey: 1}, fx2, ['hello', null, 'goodbye'])
            .then(thenFx('hello', 'goodbye'))
            .end()
            .done(function(v) {
               deepEqual(v, [["hello", "goodbye"]], 'done() function should get array with callback value');
            })
            .fail(shouldNotCall);

      // put callback in object
      function fx3(opts) {
         ok( (typeof opts === 'object'), 'argument should be an object');
         ok( (typeof opts.cb === 'function'), 'callback key should contain a function');
         opts.cb(opts.val);
      }
      S.start().handle({cbPos: 0, cbKey: 'cb'}, fx3, {val: 'hello'})
            .then(thenFx('hello'))
            .end()
            .done(function(v) {
               deepEqual(v, ["hello"], 'done() function should get array with callback value');
            })
            .fail(shouldNotCall);

      // use a placeholder
      S.start().handle(fx1, 'A', S.CB, 'C')
            .then(thenFx('A', 'C'))
            .end()
            .done(function(v) {
               deepEqual(v, [['A', 'C']], 'done() function should get array with callback values');
            })
            .fail(shouldNotCall);

   });

   test('#handle - prev step return values', function() {
      expect(5);

      function _sub(a, b, cb) {
         cb(a - b);
      }

      function _add(cb, a, b) {
         cb(a + b);
      }

      // placeholder
      S.start()
            .wrap(function() { return 10; })
            .handle(_add, S.PREV, 2)
            .then(thenFx(12))
            .handle(_add, 5, S.PREV)
            .then(thenFx(17))
            .handle(_sub, S.PREV, 2, S.CB)
            .then(thenFx(15))
            .handle(_sub, 20, S.PREV, S.CB)
            .then(thenFx(5))
            .end()
            .done(shouldCall)
            .fail(shouldNotCall);
   });

   test('#handle - error handling', function() {
      expect(9);

      S.start()
            .handle(function() { throw new Error('thrown'); })
            .then(shouldNotCall, function(e) {
               equal( (e instanceof Error), true, 'instance of Error');
               equal(e.message, 'thrown');
            })
            .wrap(function() {
               ok(false, 'should abort after a failed step');
            })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall);

      S.start()
            .handle(function(cb) { cb(new Error('callback')); })
            .then(shouldNotCall, function(e) {
               equal( (e instanceof Error), true, 'instance of Error');
               equal(e.message, 'callback');
            })
            .wrap(function() {
               ok(false, 'should abort after a failed step');
            })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall);

      S.start()
            .handle(function(cb, msg, eb) { eb(new Error(msg)); }, 'errback', S.ERR)
            .then(shouldNotCall, function(e) {
               equal( (e instanceof Error), true, 'instance of Error');
               equal(e.message, 'errback');
            })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall);
   });

   test('#handle - scoping', function() {
      function _cb1(cb) {
         ok( (this instanceof _Widget), 'is instanceof Widget');
         cb(this.val);
      }

      function _cb2(a, cb) {
         ok( (this instanceof _Widget), 'is instanceof Widget');
         cb(this.val, a);
      }

      function _Widget(val) {
         this.val = val;
      }

      // with just a scope
      S.start()
            .handle(new _Widget('hello'), _cb1)
            .then(thenFx('hello'))
            .handle(new _Widget('hello'), {cbPos: 1}, _cb2, 'world')
            .then(thenFx('hello', 'world'))
            .end()
            .done(shouldCall)
            .fail(shouldNotCall);
   });


   /******************************************
    Sequence::wrap()
    ******************************************/

   asyncTest('#wrap - vanilla run', function() {
      expect(3);
      var seq = S.start()
            .wrap(function() { return true; }) // just a plain old return value
            .then(thenFx(true))
            .wrap(deferFx, 'hello')             // try a promise
            .then(thenFx('hello'))
            .end()
            .done(function(v) {
               deepEqual(v, [true, 'hello'], 'done() should be called');
            })
            .fail(shouldNotCall)
            .always(start);
   });

   test('#wrap - return values (opts and placeholders)', function() {
      expect(5);

      function _add(a, b) {
         return a + b;
      }

      function _sub(vals) {
         return vals[0] - vals[1];
      }

      function _multiply(obj) {
         return obj.a * obj.b;
      }

      // placeholder
      S.start()
            .wrap(function() { return 10; })
            .wrap(_add, S.PREV, 2)                    // placeholder
            .then(thenFx(12))
            .wrap({prevPos: 1}, _add, 3)              // prevPos in opts
            .then(thenFx(15))
            .wrap({prevPos: 0, prevKey: 0}, _sub, [0, 2])  // as a key in array
            .then(thenFx(13))
            .wrap({prevPos: 0, prevKey: 'a'}, _multiply, {b: 2}) // as a key in object
            .then(thenFx(26))
            .end()
            .done(shouldCall)
            .fail(shouldNotCall);
   });

   test('#wrap - scoping', function() {
      expect(2);
      function _Widget(val) {
         this.val = val;
      }

      S.start()
            .wrap(new _Widget(10), function(a) { return a + this.val; }, 5)
            .then(thenFx(15))
            .end()
            .done(shouldCall)
            .fail(shouldNotCall);
   });

   test('#wrap - error handling', function() {
      expect(8);

      S.start()
            .wrap(function() { throw new Error('thrown'); })
            .then(shouldNotCall, function(e) {
               equal( (e instanceof Error), true, 'instance of Error');
               equal(e.message, 'thrown');
            })
            .wrap(function() {
               ok(false, 'should abort after a failed step');
            })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall);

      S.start()
            .wrap(function() { return new Error('return'); })
            .then(shouldNotCall, function(e) {
               equal( (e instanceof Error), true, 'instance of Error');
               equal(e.message, 'return');
            })
            .wrap(function() {
               ok(false, 'should abort after a failed step');
            })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall);

      stop(); // async test begin
      S.start()
            .wrap(rejectFx, 'promise')
            .then(shouldNotCall, function(e) {
               equal(e, 'promise');
            })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall)
            .always(start); // async test end
   });

   test('register/run - vanilla', function() {
      function fxA( a, b ) {
         return a + b;
      }

      function fxB( a, b, cb ) {
         cb(a + ' ' + b);
      }

      S.start()
            .register('fxA', fxA)
            .register('fxB', fxB, {defaults: ['A', 'B'], cbPos: 2})
            .fxA(2, 2)
            .then(thenFx(4))
            .fxB()
            .then(thenFx('A B'))
            .fxB(null, 'C')
            .then(thenFx('A C'))
            .end(true);
   });

   test('register/run - exists', function() {
      var fx = function() {},
          seq = S.start().register('fxA', fx);

      // declaring same fx twice should report an error
      raises(function() { seq.register('fxA', fx) }, Error, 'should throw an error if same method registered twice');

      // declaring an existing method should report an error
      raises(function() { seq.register('wait', fx) }, Error, 'should throw an error if registered with existing name (like wait())');

      seq.end(true);
   });

   test('register/run - bad run name', function() {
      var seq = S.start();
      raises(function() { seq.run('not a method') }, Error, 'should throw an error if run() called on method that does not exist');
      seq.end(true);
   });

   test('register/run - scope', function() {
      expect(3);

      function Widget(val) { this.val = val; }

      function fxA(a) { return a + this.val; }

      function fxB(a, cb) { cb(a + this.val); }

      S.start()
            .register('fxA', fxA)
            .register('fxB', fxB, {cbPos: 1, prevPos: 0})
            .run(new Widget(5), 'fxA', 5)
            .then(thenFx(10))
            .run(new Widget(10), 'fxB')
            .then(thenFx(20))
            .run(new Widget(5), 'fxA', S.PREV)
            .then(thenFx(25))
            .end(true);
   });

   test('register/run - placeholders', function() {
      expect(6);

      var cbCalled = false;
      function _add(a, b, cb) {
         return a+b;
      }

      function _cb1(a, cb, b) {
         equal(typeof(cb), 'function', 'expect callback to be a function');
         cb(a+b);
      }

      function _cb2(a, prev, cb) {
         equal(typeof(cb), 'function', 'expect callback to be a function');
         cb(a+prev);
      }

      S.start()
            .register('add', _add)
            .register('cb1', _cb1, {cbPos: 1})
            .register('cb2', _cb2, {cbPos: 2})
            .add(5, 5)
            .then(thenFx(10))
            .run('add', 10, S.PREV)
            .then(thenFx(20))
            .cb1(5, S.PREV)
            .then(thenFx(25))
            .cb2(2, S.PREV)
            .then(thenFx(27))
            .end(true);
   });

   test('register/run - error handling', function() {
      function _throw() { throw new Error('thrown'); }
      function _return() { return new Error('returned'); }
      function _cb(a, cb) { cb(new Error('callback')); }
      function _errback(a, b, eb, c) {
         eb(new Error('errback'));
      }

      S.start().register('throw', _throw).throw().then(
               shouldNotCall,
               function(e) { equal(e.message, 'thrown') })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall);

      S.start().register('return', _return).return().then(
            shouldNotCall,
            function(e) { equal(e.message, 'returned') })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall);


      S.start().register('cb', _cb, {cbPos: 1}).run('cb').then(
            shouldNotCall,
            function(e) { equal(e.message, 'callback') })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall);

      S.start().register('errback', _errback, {cbPos: 4, errPos: 2}).errback().then(
            shouldNotCall,
            function(e) { equal(e.message, 'errback') })
            .end()
            .done(shouldNotCall)
            .fail(shouldCall);
   });

   test('then', function() {
      expect(7);

      // should return the sequence after start()
      S.start().then(function(s) {
         ok(s instanceof S, 'start() should return a Sequence object');
      });

      // should return previous value for wrap
      S.start().wrap(function() { return 'hello'; }).then(thenFx('hello'));

      // should return previous value for handle
      S.start().handle(function(cb, v) { cb(v); }, 'hi').then(thenFx('hi'));

      // should run fail method on error thrown
      S.start()
            .wrap(function() { throw new Error('thrown'); })
            .then(shouldNotCall, function(e) {
               equal(e.message, 'thrown', 'Should run then\'s fail fx on error thrown');
            });

      // should run fail method on error returned
      S.start()
            .wrap(function() { return new Error('returned'); })
            .then(shouldNotCall, function(e) {
               equal(e.message, 'returned', 'Should run then\'s fail fx on error returned');
            });

      // should run fail method on error handled
      S.start()
            .handle(function(cb) { cb(new Error('handled')) })
            .then(shouldNotCall, function(e) {
               equal(e.message, 'handled', 'Should run then\'s fail fx on error handled by callback');
            });

      // should run fail method on errback
      S.start()
            .handle(function(cb, eb) { eb(new Error('errback')); }, S.ERR)
            .then(shouldNotCall, function(e) {
               equal(e.message, 'errback', 'Should run then\'s fail fx on errorback');
            });

      // should not throw an error
      S.start().wrap(function() {}).then(function() { throw new Error('gets logged in firebug but not thrown (discarded)'); });

   });

   asyncTest('parallel', function() {
      expect(7);
      function _inc(prev) {
         equal(prev, 'hello');
         return ++runs;
      }

      var runs = 0, startTime = new Date().getTime();
      S.start()
            .register('inc', _inc, {prevPos: 0})
            .wrap(function() { return 'hello'; })
            .parallel([
               [{wait: 500}, _inc, S.PREV],
               ['inc'],
               [{wait: 250}, 'inc'],
               [{wait: 10}, _inc, S.PREV]
            ])
            .end(true)
            .done(function(v) {
               deepEqual(v, ['hello', [4, 1, 3, 2]]);
               equal(runs, 4);
               ok((new Date().getTime() - startTime) >= 500, 'Should take at least 500 millis (the wait length)')
            })
            .always(start);
   });

   asyncTest('if', function() {
      expect(7);

      // execute a callback to prove it was run
      function invokeCallback(cbFx, val) {
         ok(true, 'should get run');
         cbFx( val );
      }

      // return a promise as an if condition
      function promiseCondition() {
         var def = $.Deferred();
         setTimeout(function() { def.resolve(); }, 100);
         return def.promise();
      }

      function _Widget(val) { this.val = val; }

      S.start()
            .register( 'getColor', function() { return 'white'; } )
         // a simple example
            .wrap( function() { return 5; } )
            .if( function(prev) { return prev > 10; },     shouldNotCall, 'Value more than 10' )            // not invoked
            .if( function(prev) { return prev == 5; },     shouldCall,    'prev == 5' )                     // invoked
            .if( function(prev, ifRes) { return !ifRes; }, shouldNotCall, 'Prior if() called' )             // not invoked
            .if( function(prev, ifRes) { return !ifRes; }, shouldCall,    'Prior if() did not get called' ) // invoked

         // with a callback function -- called with handle()
            .if( function() {return true;}, {cbPos: 0}, invokeCallback, 'Callback declared in opts' )
            .if( function() {return true;}, invokeCallback, S.CB, 'Callback added to args' )

         // as a registered function -- called with run()
            .if( function(){ return true; }, 'getColor') // a red widget
            .then(thenFx('white'))

         // with a scope object
            .if( function() { return true; }, new _Widget('red'), function(message) { return message+this.val;  }, 'Roses are... ')
            .then(thenFx('Roses are... red'))

            .end(true);

      S.start()
         // using a promise as the if condition
            .if( promiseCondition, function(v) { return v; }, 'promise' ) // runs only if promise resolves successfully
            .then(thenFx('promise'))
            .end(true)
            .always(start);

   });

   asyncTest('pause/unpause', function() {
      expect(4);
      var wait = 75, now = new Date().valueOf(), timeout;

      // start a sequence and pause it
      var seq = S.start(1000).wrap(deferFx, true);
      seq.pause();

      // trigger an unpause some time in the future
      // use .wait() so we are sure it's the right length (setTimeout is unreliable)
      S.start().wait(wait).then(function() {
         seq.unpause();
      }).end(true);

      // make sure it waited before fulfilling promises
      seq
         .wrap(function() {
            var diff = new Date().valueOf() - now;
            ok( diff >= wait, 'waited at least '+wait+' milliseconds ('+diff+')' );
            return 'hi';
         })
         .end()
         .done(function(v) {
            strictEqual(v[0], true, 'done ran after then and returned proper value');
            strictEqual(v[1], 'hi', 'done ran after then and returned proper value');
            var diff = new Date().valueOf() - now;
            ok( diff >= wait, 'waited at least '+wait+' milliseconds ('+diff+')' );
         })
         .always(function() {
            start();
         });
   });

   asyncTest('abort', function() {
      expect(2);
      var seq = S.start(1000), i, counter = 0;
      for(i=0; i < 5; i++) {
         seq.then(function() { counter++; }).wrap(deferFx);
      }
      seq.abort('yay');
      seq.end()
         .done(shouldNotCall)
         .fail(function(e) {
            equal(counter, 1, 'fail called and only one method ran');
            equal(e.message, 'yay', 'failed with error and correct message');
         })
         .always(start);
   });

   asyncTest('abort while paused', function() {
      expect(2);
      var seq = S.start(1000);
      seq
         .wrap(function() { return 1; })
         .pause()
         .wrap(function() { return 2; })
         .then(shouldNotCall, shouldCall)
         .end()
         .done(shouldNotCall)
         .fail(shouldCall)
         .always(function(vals) {
            start();
         });
      seq.abort('break it')
   });

   asyncTest('Sequence.start() with timeout', function() {
      expect(1);
      var seq = S.start(100), timeout;

      timeout = setTimeout(function() {
         timeout = false;
         seq.abort('manually ended, timeout did not fire');
         start();
      }, 1000);

      seq.wrap(function() {
            return $.Deferred().promise(); // never resolves
         })
         .end()
         .done(shouldNotCall)
         .fail(function(e) {
            ok(true, 'timed out with message "'+ e.message+'"');
         })
         .always(function() {
            if( timeout ) { clearTimeout(timeout); }
            start();
         });
   });


   asyncTest('wait', function() {
      expect(11);

      var seq = S.start();

      for( var i=0; i < 10; i++ ) {
         seq
               .wrap(_now) // establish start time
               .wait(100)                                           // wait 100
               .wrap(function(start) {                              // check end time
                  var end = _now(), diff =  end - start;
                  ok( (diff >= 100), "Must wait 100ms, waited: "+diff);
                  return end;
               }, S.PREV);
      }

      seq.end(true)
            .done(shouldCall)
            .fail(shouldNotCall)
            .always(start);
   });

   var _now = Date.now || function() {
      return new Date().getTime();
   };

   function shouldCall() {
      ok(true, 'should be invoked');
   }

   function shouldNotCall(v) {
      var e = ( v instanceof Error )? v : new Error('should not be invoked');
      console.error(e);
      throw e;
   }

   function deferFx() {
      var def = $.Deferred(), args = $.makeArray(arguments);
      setTimeout(function() {
         def.resolve.apply(def, args);
      }, 10);
      return def.promise();
   }

   function rejectFx() {
      var def = $.Deferred(), args = $.makeArray(arguments);
      setTimeout(function() {
         def.reject.apply(def, args);
      }, 10);
      return def.promise();
   }

   function thenFx() {
      var args = $.makeArray(arguments);
      return function() {
         var i = args.length;
         while(i--) {
            if( typeof(args[i]) === 'object' ) {
               deepEqual(arguments[i], args[i], 'does then() get fed the right values');
            }
            else {
               strictEqual(arguments[i], args[i], 'does then() get fed the right values');
            }
         }
      }
   }

});