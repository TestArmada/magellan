"use strict";

module.exports = {
  enabled: !!process.env.MAGELLAN_SLACK_API_KEY,

  account: process.env.MAGELLAN_SLACK_ACCOUNT_NAME,
  key: process.env.MAGELLAN_SLACK_API_KEY,
  username: process.env.MAGELLAN_SLACK_USERNAME,
  iconURL: process.env.MAGELLAN_SLACK_ICON_URL,
  channel: process.env.MAGELLAN_SLACK_NOTIFY_CHANNEL,

  jobName: process.env.JOB_NAME,
  buildDisplayName: process.env.BUILD_DISPLAY_NAME,

  buildURL: process.env.BUILD_URL
};
