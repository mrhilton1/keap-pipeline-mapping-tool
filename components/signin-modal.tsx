"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowRight, KeyRound, Shield, Loader2 } from "lucide-react"

interface SigninModalProps {
  trigger?: React.ReactNode
}

export function SigninModal({ trigger }: SigninModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = () => {
    setIsLoading(true)
    // Redirect to OAuth flow
    window.location.href = "/api/auth/keap"
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="lg" className="gap-2">
            Get Started <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">Connect to Keap</DialogTitle>
          <DialogDescription className="text-balance">
            Securely authenticate with your Keap account to start migrating your opportunities to pipelines.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Button 
            className="w-full h-11 text-base" 
            onClick={handleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Sign in with Keap
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Shield className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use OAuth 2.0 for secure authentication. We only request permissions needed to read and manage your pipelines and opportunities.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
