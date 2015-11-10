var path = require("path"),
  fs = require("fs"),
  _ = require("lodash"),
  acorn = require("acorn"),
  clc = require("cli-color"),
  walk = require("acorn/dist/walk");

module.exports = function(tags, f) {
  // Filter by tag (or tag list):
  //
  // Parse the syntax tree of each included test and search for a property
  // definition with the name "tags" with an array expression attached to it,
  // i.e. we're looking for source code in the following form:
  //
  //    tags: [ value, value, value ]
  //
  // Match each f in files against the tag list we have in the array tags.
  //
  var foundTags = false;
  var pass = false;
  var filename = path.resolve(f);
  var root;
  try {
    root = acorn.parse(fs.readFileSync(filename), {
      ecmaVersion: 6
    });
  } catch (err) {
    console.log(clc.redBright("Syntax error in parsing " + filename));
    throw err;
  }

  walk.findNodeAt(root, null, null, function (nodeType, node) {
    // Don't continue scanning if we've already passed or if we've already 
    // found the tags: [] structure.
    if (!foundTags && !pass) {
      if (nodeType === "Property" && node.key && node.key.name === "tags" && node.value && node.value.type === "ArrayExpression" && node.value.elements) {
        foundTags = true;

        // Collect the tags this test matches
        var localTags = [];
        node.value.elements.forEach(function (tagNode) {
          if (tagNode.value && typeof tagNode.value === "string") {
            localTags.push(tagNode.value.trim());
          }
        });

        // check if each of tags exists in this test case (in localTags)
        if (tags.every(function (wantedTag) {
          return localTags.indexOf(wantedTag) > -1;
        })) {
          pass = true;
        }

      }
    }
  });

  return pass;
};