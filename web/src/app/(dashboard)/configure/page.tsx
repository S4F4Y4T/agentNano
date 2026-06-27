"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";
import { useAppData } from "@/lib/app-data";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  PROVIDER_BASE_URLS,
  PROVIDER_LABELS,
  PROVIDER_MODEL_PLACEHOLDERS,
  type ProviderType,
} from "@/lib/types";

const configSchema = z.object({
  providerType: z.enum(["openai", "gemini", "openrouter", "custom"]),
  baseUrl: z.string().min(1, "Base URL is required"),
  apiKey: z.string().optional(),
  model: z.string().min(1, "Model is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
});

type ConfigValues = z.infer<typeof configSchema>;

export default function ConfigurePage() {
  const { agentConfig, saveAgentConfig, testAgentConnection } = useAppData();
  const isFirstSetup = !agentConfig;

  const baseSchema = isFirstSetup
    ? configSchema.refine((v) => !!v.apiKey, {
        message: "API key is required",
        path: ["apiKey"],
      })
    : configSchema;

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ConfigValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: agentConfig
      ? {
          providerType: agentConfig.providerType,
          baseUrl: agentConfig.baseUrl,
          apiKey: "",
          model: agentConfig.model,
          systemPrompt: agentConfig.systemPrompt,
        }
      : {
          providerType: "openai",
          baseUrl: PROVIDER_BASE_URLS.openai,
          apiKey: "",
          model: "",
          systemPrompt: "You are AgentNano, a helpful desk companion. Be concise and clear.",
        },
  });

  useEffect(() => {
    document.title = "Configure — AgentNano";
  }, []);

  const providerType = watch("providerType");

  const onSubmit = async (values: ConfigValues) => {
    try {
      await saveAgentConfig(values);
      toast.success(isFirstSetup ? "Agent configured" : "Agent configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save agent configuration");
    }
  };

  const handleTest = () => {
    toast.promise(testAgentConnection(), {
      loading: "Testing connection...",
      success: "Connection succeeded",
      error: "Couldn't reach the provider",
    });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
        <div>
          <h1 className="font-heading text-xl font-bold">Configure your agent</h1>
          <p className="text-sm text-muted-foreground">
            Connect a provider, define how AgentNano behaves, and start chatting.
          </p>
        </div>

        {agentConfig && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <StatusPill
                variant={
                  agentConfig.status === "connected"
                    ? "success"
                    : agentConfig.status === "error"
                      ? "destructive"
                      : "warning"
                }
              >
                {agentConfig.status === "connected"
                  ? "Connected"
                  : agentConfig.status === "error"
                    ? "Error"
                    : "Untested"}
              </StatusPill>
              <span className="text-xs text-muted-foreground">
                Saved {formatRelativeTime(agentConfig.updatedAt)}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleTest}>
              <Zap className="size-3.5" />
              Test connection
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
            <h2 className="font-heading text-sm font-bold">Provider</h2>

            <div className="flex flex-col gap-1.5">
              <Label>Provider</Label>
              <Controller
                control={control}
                name="providerType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value: ProviderType | null) => {
                      if (!value) return;
                      field.onChange(value);
                      setValue("baseUrl", PROVIDER_BASE_URLS[value]);
                      setValue("model", PROVIDER_MODEL_PLACEHOLDERS[value]);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value: ProviderType) => PROVIDER_LABELS[value]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Base URL and a default model are filled in automatically — switch
                providers any time to update them.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  disabled={providerType !== "custom"}
                  {...register("baseUrl")}
                />
                {errors.baseUrl && (
                  <p className="text-xs text-destructive">{errors.baseUrl.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="model">Model</Label>
                <Input id="model" {...register("model")} />
                {errors.model && (
                  <p className="text-xs text-destructive">{errors.model.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apiKey">API key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={
                  agentConfig
                    ? `Currently ${agentConfig.apiKeyMasked} — leave blank to keep it`
                    : "sk-..."
                }
                {...register("apiKey")}
              />
              {errors.apiKey && (
                <p className="text-xs text-destructive">{errors.apiKey.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
            <h2 className="font-heading text-sm font-bold">Behavior</h2>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="systemPrompt">System prompt</Label>
              <Textarea id="systemPrompt" rows={6} {...register("systemPrompt")} />
              {errors.systemPrompt && (
                <p className="text-xs text-destructive">
                  {errors.systemPrompt.message}
                </p>
              )}
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isFirstSetup ? "Connect your agent" : "Save changes"}
          </Button>
        </form>
      </div>
    </div>
  );
}
