const React = require('react');

function MockIcon() {
  return React.createElement(React.Fragment, null);
}

module.exports = new Proxy(
  {
    __esModule: true,
    // Keep common named exports stable when destructured.
    LucideIcon: MockIcon,
  },
  {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      return MockIcon;
    },
  }
);

