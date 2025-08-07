module.exports = {
    eq: (a, b) => a === b,
    lt: (a, b) => a < b,
    lte: (a, b) => a <= b,
    ne: (a, b) => a != b,
    gt: (a, b) => a > b,
    add: (a, b) => a + b,
    multiply: (a, b) => a * b,
    subtract: (a, b) => a - b,
    range: function (start, end) {
        let arr = [];
        for (let i = start; i <= end; i++) arr.push(i);
        return arr;
    },
    truncate: function (str, len) {
        if (typeof str === 'string' && str.length > len) {
            return str.substring(0, len) + '...';
        }
        return str;
    },
    isGreaterThanZero: function (value, options) {
        return Number(value) > 0 ? options.fn(this) : options.inverse(this);
    },

    json: function (context) {
        return JSON.stringify(context);
    },
    ifEquals: function (a, b, options) {
        if (typeof options !== 'object' || !options.fn) {
            return a == b || a?.toString() === b?.toString();
        }

        if (a == b || a?.toString() === b?.toString()) {
            return options.fn(this);
        }
        return options.inverse(this);
    },

    isInWishlist: function (productId, wishlistProductIds) {
        if (!wishlistProductIds || !Array.isArray(wishlistProductIds)) return false;
        return wishlistProductIds.includes(productId.toString());
    },

    includes: function (array, value) {
        if (!array || !Array.isArray(array)) return false;
        return array.includes(value.toString());
    },

    ifCond: function (v1, operator, v2, options) {
        v1 = v1?.toString?.();
        v2 = v2?.toString?.();
        switch (operator) {
            case '==': return (v1 == v2) ? options.fn(this) : options.inverse(this);
            case '===': return (v1 === v2) ? options.fn(this) : options.inverse(this);
            case '!=': return (v1 != v2) ? options.fn(this) : options.inverse(this);
            case '!==': return (v1 !== v2) ? options.fn(this) : options.inverse(this);
            case '<': return (v1 < v2) ? options.fn(this) : options.inverse(this);
            case '<=': return (v1 <= v2) ? options.fn(this) : options.inverse(this);
            case '>': return (v1 > v2) ? options.fn(this) : options.inverse(this);
            case '>=': return (v1 >= v2) ? options.fn(this) : options.inverse(this);
            case '&&': return (v1 && v2) ? options.fn(this) : options.inverse(this);
            case '||': return (v1 || v2) ? options.fn(this) : options.inverse(this);
            default: return options.inverse(this);
        }
    },
    or: function () {
        const args = Array.from(arguments).slice(0, -1); // remove handlebars options object
        return args.some(Boolean);
    },
    formatINR: (value) => {
        if (typeof value !== 'number') value = Number(value);
        return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    },
    formatDate: (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },
    eq: (a, b) => {
        return a === b;
    },
    and: function () {
        const args = Array.from(arguments).slice(0, -1);
        return args.every(Boolean);
    },
    formatDate: function (date) {
        if (!date) return '';
        return new Date(date).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    not: function (value) {
        return !value;
    },
    formatNumber: function (value) {
        if (typeof value !== 'number') value = Number(value);
        return value.toLocaleString('en-IN'); 
    },
    dashCase: function (str) {
        if (!str || typeof str !== 'string') return '';
        return str.trim().toLowerCase().replace(/\s+/g, '-');
    },
    formatNumberFixed: function (value) {
        if (isNaN(value)) return '0.00';
        return Number(value).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }, lowercase: function (str) {
        return str.toLowerCase();
    }, firstName: function(fullName) {
      return fullName.split(' ')[0];
    },
}