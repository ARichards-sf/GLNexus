import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { sampleHouseholds, formatCurrency } from "@/data/sampleData";

export default function Households() {
  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Households</h1>
        <p className="text-muted-foreground mt-1">{sampleHouseholds.length} households in your book</p>
      </div>

      <div className="space-y-3">
        {sampleHouseholds.map((h) => (
          <Link key={h.id} to={`/household/${h.id}`}>
            <Card className="border-border shadow-none hover:bg-secondary/40 transition-colors cursor-pointer group">
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground">
                    {h.name.split(" ")[1]?.[0] || h.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{h.members.length} members · {h.riskTolerance}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(h.totalAUM)}</p>
                    <p className="text-xs text-muted-foreground">AUM</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
