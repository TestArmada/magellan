General Magellan Plugin/Report Error Handling/Propagation 
======================

# What is this document about

This document provides the general error handling rules that are required by magellan to properly propagate or escalate to the final magellan result for customized magellan reporter or magellan plugin's purpose. Magellan restricts following rules while dealing with report and plugins. Any usage that is not following those rules will lead to an unexpected result from customized report or plugin.

# Error handling rules

There are generally two ways that a reporter or plugin interacts with magellan.

## Via function call

**Summary**

| TYPE | DO | DON'T |
| ---- | ---- | ---- |
| Via callback | Error-first callback handling convention | Throw error out; Eat error; Put error in other param |
| Via return value | Throw error out | Eat error; Return error |
| Via promise | Reject error; Throw error | Resolve error |

**Example**

### Via callback
```
invoke(test, callback){
  // if something is wrong, put error in the first param of callback
  callback(err, null);
}

/** DON'T 
 *
 * 1. Throws error out
 * invoke(test, callback){
 *   throws new Error(err);
 * }

 * 2. Eat error
 * invoke(test, callback){
 *   try{
 *     do();
 *   }catch(err){
 *     // do nothing here 
 *   }finally{
 *     callback();
 *   }
 * }

 * 3. Put error in other param
 * invoke(test, callback){
 *   callback(null, err);
 * }
 */
```

### Via return value 
```
group(prefix, testLocator) {
  /* return true if testLocator satisfies prefix from --group=a/b/c*/
  
  // if something is wrong, throws it
  throws new Error(PLGUIN NAME AND ERROR DETAIL);
}

/** DON'T
 * 1. Eat error
 * group(prefix, testLocator) {
 *   try{
 *     return do();
 *   }catch(err){
 *   // do nothing here
 *     return null;
 *   }
 * }
 *
 * 2. Return error
 * group(prefix, testLocator) {
 *   return new Error(PLGUIN NAME AND ERROR DETAIL);
 * }
 */
```

### Via promise
```
drain(messages){
  return new Promise((resolve, reject) =>{
    // if something is wrong, reject it
    reject(err);
  });
}

// another way
drain(message){
  return Promise.reject("PLGUIN NAME AND ERROR DETAIL");
}

// if you're using bluebird as your promise library,
// you can also throw error out
drain(message){
  throws new Error("PLGUIN NAME AND ERROR DETAIL");
}

/** DON'T
 * 1. Resolve error
 * drain(messages){
 *   return new Promise((resolve, reject) =>{
 *     // if something is wrong, reject it
 *     resolve(err);
 *   });
 * }
 *
 * // or 
 * drain(message){
 *   return Promise.resolve("PLGUIN NAME AND ERROR DETAIL");
 * }
 */
```
## Via child process 

**Summary**
| TYPE | DO | DON'T |
| ---- | ---- | ---- |
| Via return value | return zero | return a none zero value |

**Example**

### Via return value
```
require("../src/cli")()
  .then(function () {
    process.exit(0);
  })
  .catch(function () {
    process.exit(1);
  });
```

# What magellan provides

Magellan follows the above rules if it works as a plugin to other utilities. 