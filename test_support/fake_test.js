setTimeout(function () {
  if (process.argv.filter(function (token) {
    return token.indexOf("fail") > -1;
  }).length > 0) {
    console.log("Test framework returning failure exit code");
    process.exit(1);
  } else {
    console.log("Test framework returning success exit code");
    process.exit(0);
  }
}, 50);
