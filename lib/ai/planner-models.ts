import { z } from "zod";
const ModelSchema=z.object({id:z.string().max(200),name:z.string(),context_length:z.number().int().min(8192),
  supported_parameters:z.array(z.string()),pricing:z.record(z.string()).refine(prices=>
    ["prompt","completion"].every(key=>key in prices)&&Object.values(prices).every(price=>/^(?:0|0\.0+)$/.test(price)),"All applicable inference prices must be zero."),
}).passthrough();
export type FreePlannerModel=z.infer<typeof ModelSchema>;
export function freePlannerModels(models:unknown[]):FreePlannerModel[]{
  return models.flatMap(value=>{const model=ModelSchema.safeParse(value);return model.success&&model.data.id.endsWith(":free")&&["tools","tool_choice"].every(key=>model.data.supported_parameters.includes(key))?[model.data]:[];});
}
