import env from "./env";

const ignores = env.LAYERS_TO_IGNORE;

export function shouldIgnoreLayer(layer: string) {
  for (const ignore of ignores) {
    if (layer.toLowerCase().includes(ignore.toLowerCase())) {
      return true;
    }
  }

  return false;
}