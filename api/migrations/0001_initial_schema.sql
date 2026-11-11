
-- 1. Homes
CREATE TABLE homes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_homes_name
        CHECK (length(trim(name)) > 0)
);

-- 2. Members
CREATE TABLE members (
    id TEXT PRIMARY KEY,
    home_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_members_home
        FOREIGN KEY (home_id) REFERENCES homes(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_members_home_name
        UNIQUE (home_id, name),

    CONSTRAINT uq_members_id_home
        UNIQUE (id, home_id),

    CONSTRAINT chk_members_name
        CHECK (length(trim(name)) > 0)
);

-- 3. Bills
CREATE TABLE bills (
    id TEXT PRIMARY KEY,
    home_id TEXT NOT NULL,
    title TEXT NOT NULL,
    total_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_bills_home
        FOREIGN KEY (home_id) REFERENCES homes(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_bills_id_home
        UNIQUE (id, home_id),

    CONSTRAINT chk_bills_title
        CHECK (length(trim(title)) > 0),

    CONSTRAINT chk_bills_total_cents
        CHECK (total_cents > 0)
);

-- 4. Shares
CREATE TABLE shares (
    id TEXT PRIMARY KEY,
    bill_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    home_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_at TEXT,
    idempotency_key TEXT,

    CONSTRAINT fk_shares_bill_home
        FOREIGN KEY (bill_id, home_id)
        REFERENCES bills(id, home_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_shares_member_home
        FOREIGN KEY (member_id, home_id)
        REFERENCES members(id, home_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_shares_bill_member
        UNIQUE (bill_id, member_id),

    CONSTRAINT uq_shares_idempotency_key
        UNIQUE (idempotency_key),

    CONSTRAINT chk_shares_amount_cents
        CHECK (amount_cents >= 0),

    CONSTRAINT chk_shares_payment_state
        CHECK (
            (paid_at IS NULL AND idempotency_key IS NULL)
            OR
            (paid_at IS NOT NULL AND idempotency_key IS NOT NULL)
        )
);

-- 5. Indexes for common queries
CREATE INDEX idx_members_home_id
    ON members(home_id);

CREATE INDEX idx_bills_home_id
    ON bills(home_id);

CREATE INDEX idx_shares_bill_id
    ON shares(bill_id);

CREATE INDEX idx_shares_member_id
    ON shares(member_id);

CREATE INDEX idx_shares_unpaid
    ON shares(home_id, member_id)
    WHERE paid_at IS NULL;
