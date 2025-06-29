import {
  buildSearchQuery,
  parseSearchOperators,
  validateSearchOperators,
  ISearchOperators
} from '../searchOperators';

describe('Search Operators', () => {
  describe('buildSearchQuery', () => {
    it('should return base query when no operators provided', () => {
      const result = buildSearchQuery('test query');
      expect(result).toBe('test query');
    });

    it('should return base query when operators object is empty', () => {
      const result = buildSearchQuery('test query', {});
      expect(result).toBe('test query');
    });

    it('should add site operator correctly', () => {
      const result = buildSearchQuery('nodejs', { site: 'github.com' });
      expect(result).toBe('nodejs site:github.com');
    });

    it('should add filetype operator correctly', () => {
      const result = buildSearchQuery('documentation', { filetype: 'pdf' });
      expect(result).toBe('documentation filetype:pdf');
    });

    it('should add multiple operators correctly', () => {
      const result = buildSearchQuery('api', {
        site: 'docs.microsoft.com',
        filetype: 'pdf',
        intitle: 'reference'
      });
      expect(result).toBe('api site:docs.microsoft.com filetype:pdf intitle:reference');
    });

    it('should handle location with spaces by adding quotes', () => {
      const result = buildSearchQuery('restaurants', { location: 'New York' });
      expect(result).toBe('restaurants location:"New York"');
    });

    it('should handle location without spaces without quotes', () => {
      const result = buildSearchQuery('restaurants', { location: 'London' });
      expect(result).toBe('restaurants location:London');
    });

    it('should handle exclude operator with multiple values', () => {
      const result = buildSearchQuery('recipes', { exclude: 'vegan, gluten-free' });
      expect(result).toBe('recipes -vegan -gluten-free');
    });

    it('should handle exclude operator with pre-existing minus sign', () => {
      const result = buildSearchQuery('recipes', { exclude: '-vegan, -vegetarian' });
      expect(result).toBe('recipes -vegan -vegetarian');
    });

    it('should handle exact phrase operator', () => {
      const result = buildSearchQuery('', { exact: 'machine learning algorithms' });
      expect(result).toBe('"machine learning algorithms"');
    });

    it('should handle exact phrase with existing quotes', () => {
      const result = buildSearchQuery('', { exact: '"already quoted"' });
      expect(result).toBe('"already quoted"');
    });

    it('should handle OR operator correctly', () => {
      const result = buildSearchQuery('programming', { or: ['python', 'javascript', 'typescript'] });
      expect(result).toBe('programming (python OR javascript OR typescript)');
    });

    it('should handle empty base query with operators', () => {
      const result = buildSearchQuery('', { site: 'stackoverflow.com', intitle: 'error' });
      expect(result).toBe('site:stackoverflow.com intitle:error');
    });

    it('should handle all operators together', () => {
      const operators: ISearchOperators = {
        site: 'github.com',
        filetype: 'md',
        intitle: 'readme',
        inurl: 'docs',
        exclude: 'deprecated, old',
        exact: 'getting started',
        or: ['guide', 'tutorial']
      };
      const result = buildSearchQuery('documentation', operators);
      expect(result).toBe('documentation site:github.com filetype:md intitle:readme inurl:docs -deprecated -old "getting started" (guide OR tutorial)');
    });
  });

  describe('parseSearchOperators', () => {
    it('should return empty operators for query without operators', () => {
      const result = parseSearchOperators('simple search query');
      expect(result.baseQuery).toBe('simple search query');
      expect(result.operators).toEqual({});
    });

    it('should parse site operator', () => {
      const result = parseSearchOperators('nodejs site:github.com');
      expect(result.baseQuery).toBe('nodejs');
      expect(result.operators.site).toBe('github.com');
    });

    it('should parse multiple operators', () => {
      const result = parseSearchOperators('api docs site:microsoft.com filetype:pdf intitle:reference');
      expect(result.baseQuery).toBe('api docs');
      expect(result.operators).toEqual({
        site: 'microsoft.com',
        filetype: 'pdf',
        intitle: 'reference'
      });
    });

    it('should parse quoted operator values', () => {
      const result = parseSearchOperators('restaurants location:"New York"');
      expect(result.baseQuery).toBe('restaurants');
      expect(result.operators.location).toBe('New York');
    });

    it('should parse exclusions', () => {
      const result = parseSearchOperators('recipes -vegan -gluten');
      expect(result.baseQuery).toBe('recipes');
      expect(result.operators.exclude).toBe('vegan, gluten');
    });

    it('should parse exact phrases', () => {
      const result = parseSearchOperators('search for "exact phrase" in results');
      expect(result.baseQuery).toBe('search for in results');
      expect(result.operators.exact).toBe('exact phrase');
    });

    it('should not include quoted operator values as exact phrases', () => {
      const result = parseSearchOperators('location:"San Francisco" restaurants');
      expect(result.baseQuery).toBe('restaurants');
      expect(result.operators.location).toBe('San Francisco');
      expect(result.operators.exact).toBeUndefined();
    });

    it('should parse OR operators', () => {
      const result = parseSearchOperators('python OR javascript programming');
      expect(result.baseQuery).toBe('programming');
      expect(result.operators.or).toEqual(['python', 'javascript']);
    });

    it('should parse complex query with all operator types', () => {
      const query = 'web development site:github.com filetype:md -deprecated "best practices" react OR vue';
      const result = parseSearchOperators(query);
      expect(result.baseQuery).toBe('web development');
      expect(result.operators).toEqual({
        site: 'github.com',
        filetype: 'md',
        exclude: 'deprecated',
        exact: 'best practices',
        or: ['react', 'vue']
      });
    });
  });

  describe('validateSearchOperators', () => {
    it('should return empty array for valid operators', () => {
      const operators: ISearchOperators = {
        site: 'example.com',
        filetype: 'pdf',
        region: 'us',
        language: 'en'
      };
      const errors = validateSearchOperators(operators);
      expect(errors).toEqual([]);
    });

    it('should validate invalid filetype', () => {
      const operators: ISearchOperators = {
        filetype: 'invalid'
      };
      const errors = validateSearchOperators(operators);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid filetype: invalid');
    });

    it('should validate invalid region', () => {
      const operators: ISearchOperators = {
        region: 'xx'
      };
      const errors = validateSearchOperators(operators);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid region: xx');
    });

    it('should validate invalid language', () => {
      const operators: ISearchOperators = {
        language: 'xx'
      };
      const errors = validateSearchOperators(operators);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid language: xx');
    });

    it('should validate invalid prefer value', () => {
      const operators: ISearchOperators = {
        prefer: 'invalid'
      };
      const errors = validateSearchOperators(operators);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid prefer value: invalid');
    });

    it('should validate invalid IP address', () => {
      const operators: ISearchOperators = {
        ip: '999.999.999.999'
      };
      const errors = validateSearchOperators(operators);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Invalid IP address format');
    });

    it('should validate multiple invalid operators', () => {
      const operators: ISearchOperators = {
        filetype: 'invalid',
        region: 'xx',
        language: 'yy',
        ip: 'not-an-ip'
      };
      const errors = validateSearchOperators(operators);
      expect(errors).toHaveLength(4);
    });

    it('should accept valid values in any case', () => {
      const operators: ISearchOperators = {
        filetype: 'PDF',
        region: 'US',
        language: 'EN',
        prefer: 'NEWER'
      };
      const errors = validateSearchOperators(operators);
      expect(errors).toEqual([]);
    });
  });
});
