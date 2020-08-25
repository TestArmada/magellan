setTimeout(() => {
  if (process.argv.filter((token) => {
    return token.indexOf("fail") > -1;
  }).length > 0) {
    console.log("Test framework returning failure exit code");
    process.exit(1);
  } else if (process.argv.filter((token) => {
    return token.indexOf("zombie") > -1;
  }).length > 0) {
    console.log("Test framework simulating a zombie");
    // Spin forever to simulate a stuck process
    setInterval(() => {

    }, 500);
  } else {
    console.log("Test framework returning success exit code");
    process.exit(0);
  }
}, 50);
