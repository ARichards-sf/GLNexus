import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { useHouseholds } from "@/hooks/useHouseholds";
import { formatCurrency } from "@/data/sampleData";

export default function Households() {
  const { data: households = [], isLoading } = useHouseholds();

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-48" />
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-secondary rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Households</h1>
        <p className="text-muted-foreground mt-1">{households.length} households in your book</p>
      </div>

      <div className="space-y-3">
        {households.map((h) => (
          <Link key={h.id} to={`/household/${h.id}`}>
            <Card className="border-border shadow-none hover:bg-secondary/40 transition-colors cursor-pointer group">
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground">
                    {h.name.split(" ")[1]?.[0] || h.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{h.risk_tolerance}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(h.total_aum))}</p>
                    <p className="text-xs text-muted-foreground">AUM</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {households.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No households yet. Add your first household to get started.</p>
        )}
      </div>
    </div>
  );
}
