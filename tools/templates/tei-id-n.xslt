<?xml version="1.0" ?>
<xsl:stylesheet version="1.0" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="http://www.tei-c.org/ns/1.0">
  <xsl:output method="xml" encoding="utf-8" indent="no"/>
  
  <xsl:template match="/">
    <mapping>
      <xsl:apply-templates select="/tei:TEI/tei:text/tei:body/tei:div[@type='edition'][not(@subtype)]" />
    </mapping>
  </xsl:template>

  <xsl:template match="tei:div[@type='edition']">
    {
      <xsl:apply-templates select=".//*[@xml:id]" />
    }
  </xsl:template>

  <xsl:template match="*[@xml:id]">
    "<xsl:value-of select="@xml:id"/>": ["<xsl:value-of select="@n"/>", "<xsl:value-of select="name(.)"/>"],
  </xsl:template>
</xsl:stylesheet>
