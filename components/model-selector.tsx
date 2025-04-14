import { availableModels } from "@/lib/ai/models";

interface ModelSelectorProps {
  selectedModel: string;
  onModelSelect: (model: string) => void;
}

export function ModelSelector({ selectedModel }: ModelSelectorProps) {
  const modelName = availableModels[selectedModel]?.name || "GPT-3.5 Turbo";

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-400 cursor-not-allowed opacity-50">
      <span>Using {modelName}</span>
      <span className="text-xs">(Fixed)</span>
    </div>
  );
}
