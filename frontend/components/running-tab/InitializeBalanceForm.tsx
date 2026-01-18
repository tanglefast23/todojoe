"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface InitializeBalanceFormProps {
  onInitialize: (amount: number) => void;
}

export function InitializeBalanceForm({
  onInitialize,
}: InitializeBalanceFormProps) {
  const [amount, setAmount] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (numAmount > 0) {
      onInitialize(numAmount);
    }
  };

  // Format input as user types
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    if (value) {
      const num = parseInt(value, 10);
      setAmount(num.toLocaleString("vi-VN"));
    } else {
      setAmount("");
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Initialize Running Tab</CardTitle>
        <CardDescription>
          Set the starting balance for your household tab. This can only be done
          once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Starting Balance (VND)</label>
            <Input
              type="text"
              value={amount}
              onChange={handleChange}
              placeholder="1,000,000"
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!amount}>
            Initialize Tab
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
