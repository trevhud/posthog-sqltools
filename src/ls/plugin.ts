import { ILanguageServerPlugin } from "@sqltools/types";
import PostHogDriver from "./driver";
import { DRIVER_ALIASES } from "../constants"; // Path to src/sqltools/constants.ts

const PostHogDriverPlugin: ILanguageServerPlugin = {
  register(server) {
    DRIVER_ALIASES.forEach(({ value }) => {
      // Register the driver class with the SQLTools language server context.
      // SQLTools will be responsible for instantiating this class when a connection is made.
      server.getContext().drivers.set(value, PostHogDriver as any);
    });
  },
};

export default PostHogDriverPlugin;
