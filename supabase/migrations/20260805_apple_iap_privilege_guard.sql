-- Extend profile privilege guard to protect Apple IAP entitlement columns.
-- Service-role paths (IAP verify API, Stripe webhooks) may still write these fields.

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := coalesce(auth.role(), '');
  v_uid uuid := auth.uid();
BEGIN
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.subscription_plan := 'free';
    NEW.subscription_status := 'inactive';
    NEW.subscription_provider := 'none';
    NEW.stripe_customer_id := NULL;
    NEW.stripe_subscription_id := NULL;
    NEW.subscription_current_period_end := NULL;
    NEW.apple_product_id := NULL;
    NEW.apple_original_transaction_id := NULL;
    NEW.apple_transaction_id := NULL;
    NEW.apple_environment := NULL;
    NEW.is_disabled := false;
    NEW.admin_founder_granted := false;
    NEW.beta_status := 'pending';
    NEW.household_id := NULL;
    NEW.last_active_at := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
      OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
      OR NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end
      OR NEW.subscription_provider IS DISTINCT FROM OLD.subscription_provider
      OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
      OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
      OR NEW.apple_product_id IS DISTINCT FROM OLD.apple_product_id
      OR NEW.apple_original_transaction_id IS DISTINCT FROM OLD.apple_original_transaction_id
      OR NEW.apple_transaction_id IS DISTINCT FROM OLD.apple_transaction_id
      OR NEW.apple_environment IS DISTINCT FROM OLD.apple_environment
      OR NEW.is_disabled IS DISTINCT FROM OLD.is_disabled
      OR NEW.admin_founder_granted IS DISTINCT FROM OLD.admin_founder_granted
      OR NEW.beta_status IS DISTINCT FROM OLD.beta_status
    THEN
      RAISE EXCEPTION 'profile_privilege_escalation_blocked'
        USING ERRCODE = '42501',
              HINT = 'Subscription, beta, admin, and account status fields are managed by Buxme.';
    END IF;

    IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
      IF NEW.household_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.household_members hm
          WHERE hm.household_id = NEW.household_id
            AND hm.user_id = v_uid
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.households h
          WHERE h.id = NEW.household_id
            AND h.owner_id = v_uid
        )
      THEN
        RAISE EXCEPTION 'profile_household_escalation_blocked'
          USING ERRCODE = '42501',
                HINT = 'Household membership can only change through household flows.';
      END IF;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'profile_id_change_blocked' USING ERRCODE = '42501';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      NEW.created_at := OLD.created_at;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
