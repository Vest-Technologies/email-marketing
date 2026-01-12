"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  AlertCircle, 
  Eye, 
  CheckCircle2, 
  Send,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineStatsProps {
  stats: {
    total: number;
    byState: {
      pending_generation: number;
      email_not_generated: number;
      pending_review: number;
      approved_to_send: number;
      sent: number;
    };
  };
  onStateClick?: (state: string) => void;
  activeState?: string;
}

const stateConfig = {
  pending_generation: {
    label: "Pending Generation",
    icon: Clock,
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
    activeColor: "bg-slate-500 text-white",
  },
  email_not_generated: {
    label: "Not Generated",
    icon: AlertCircle,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    activeColor: "bg-amber-500 text-white",
  },
  pending_review: {
    label: "Pending Review",
    icon: Eye,
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    activeColor: "bg-blue-500 text-white",
  },
  approved_to_send: {
    label: "Approved",
    icon: CheckCircle2,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    activeColor: "bg-emerald-500 text-white",
  },
  sent: {
    label: "Sent",
    icon: Send,
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    activeColor: "bg-purple-500 text-white",
  },
};

export function PipelineStats({ stats, onStateClick, activeState }: PipelineStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Total Card */}
      <Card className="col-span-2 md:col-span-3 lg:col-span-1 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-200/50 dark:border-indigo-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Total Companies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-foreground">{stats.total}</div>
        </CardContent>
      </Card>

      {/* State Cards */}
      {Object.entries(stateConfig).map(([state, config]) => {
        const count = stats.byState[state as keyof typeof stats.byState] || 0;
        const Icon = config.icon;
        const isActive = activeState === state;

        return (
          <Card
            key={state}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-md border",
              isActive ? config.activeColor : config.color,
              onStateClick && "hover:scale-[1.02]"
            )}
            onClick={() => onStateClick?.(state)}
          >
            <CardHeader className="pb-2">
              <CardTitle className={cn(
                "text-sm font-medium flex items-center gap-2",
                isActive ? "text-inherit" : ""
              )}>
                <Icon className="h-4 w-4" />
                {config.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                isActive ? "text-inherit" : ""
              )}>
                {count}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
