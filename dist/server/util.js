// Asynchronous for each, doing a limited number of things at a time.
async function asyncForEach(array, limit, callback) {
    let i = 0;
    for (; i < limit; i++) {
        doNextThing(i);
    }
    function doNextThing(index) {
        if (array[index]) {
            callback(array[index], index, array, function done() {
                doNextThing(i++);
            });
        }
    }
    return 1;
}
export { asyncForEach };
//# sourceMappingURL=util.js.map