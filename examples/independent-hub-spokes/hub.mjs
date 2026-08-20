// Compatibility entrypoint. All profiles run through the same node program.
process.argv.splice(2, 0, "hub");
await import("./node.mjs");
