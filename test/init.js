import { runTests } from "moon-unit";
import { Observable } from "../src/Observable.js";

runTests({

    "Cancellation functions": {

        "Allowed return values" (test) {

            let type = "",
                next = v => {};

            test
            ._("Undefined can be returned")
            .not().throws(_=> new Observable(next => undefined).subscribe(next))
            ._("Null can be returned")
            .not().throws(_=> new Observable(next => null).subscribe(next))
            ._("Functions can be returned")
            .not().throws(_=> new Observable(next => function() {}).subscribe(next))
            ._("Non-functions cannot be returned")
            .throws(_=> new Observable(next => 0).subscribe(next))
            .throws(_=> new Observable(next => false).subscribe(next))
            ._("Objects without an unsubscribe property cannot be returned")
            .throws(_=> new Observable(next => ({})).subscribe(next))
            ._("The unsubscribe property must be a function")
            .throws(_=> new Observable(next => ({ unsubscribe: 1 })).subscribe(next))
            .not().throws(_=> new Observable(next => ({ unsubscribe() {} })).subscribe(next))
            ;
        },


        "Call invariants" (test) {

            let called = 0,
                returned = 0;

            let subscription = new Observable(sink => {
                return _=> { called++ };
            }).subscribe(
                x => {},
                null,
                x => { returned++ }
            );

            subscription.unsubscribe();

            test._("The stop function is called when unsubscribing")
            .equals(called, 1);

            subscription.unsubscribe();

            test._("The stop function is not called again when unsubscribe is called again")
            .equals(called, 1);

            test._("The return method of the sink is not automatically called")
            .equals(returned, 0);

            called = 0;

            /*
            new Observable(sink => {
                sink.next(1);
                return _=> { called++ };
            }).subscribe(v => ({ done: true }));

            test._("The stop function is called when the sink returns a done result")
            .equals(called, 1);

            called = 0;

            new Observable(sink => {
                sink.throw(1);
                return _=> { called++ };
            }).subscribe({
                next(v) {},
                throw(v) {},
            });

            test._("The stop function is called when an error is sent to the sink")
            .equals(called, 1);

            called = 0;

            new Observable(sink => {
                sink.return(1);
                return _=> { called++ };
            }).subscribe({
                next(v) {},
                return(v) {},
            });

            test._("The stop function is called when a return is sent to the sink")
            .equals(called, 1);
            */
        },

    }

});
