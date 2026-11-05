-- SQL original del Power BI, extraído sin cambios de la partición M de
-- BI Costo producto terminado.SemanticModel/definition/tables/Maestro.tmdl (la tabla Nivel 1 usa el mismo SQL).
-- Solo se decodificaron #(lf) y #(tab). Referencia histórica: la migración usa query-optimizado.sql.

--Declare @Code1 Varchar(20) 
--Set @Code1 = /* P0.Code */ '[%0]';
--Set @Code1 = /* P0.Code */ 'CBAN05-0001-000-0438';


--Declare @Code2 Varchar(20) 
--Set @Code2 = /* P0.Code */ '[%1]';
--Set @Code2 = /* P0.Code */ 'PEMP04-0013-000-0000';

CREATE TABLE #TBomNew
(
[linea] [int] NULL,
[Codigo] [varchar](20) NULL,
[Descripcion] [varchar](100) NULL,
[Nivel] [int] NULL,
[Cantidad] [decimal](18, 6) NULL,
[Costo_Unitario] [decimal](18, 6) NULL,
[Costo_Mp] [decimal](18, 6) NULL,
[Costo_Mo] [decimal](18, 6) NULL,
[Costo_Cif] [decimal](18, 6) NULL,
[Costo_Total] [decimal](18, 6) NULL,
[Padre] [Varchar] (20) NULL
)
CREATE TABLE #TBomGlobal
(
[linea] [int] NULL,
[Codigo] [varchar](20) NULL,
[Descripcion] [varchar](100) NULL,
[Nivel] [int] NULL,
[Cantidad] [decimal](18, 6) NULL,
[Costo_Unitario] [decimal](18, 6) NULL,
[Costo_Mp] [decimal](18, 6) NULL,
[Costo_Mo] [decimal](18, 6) NULL,
[Costo_Cif] [decimal](18, 6) NULL,
[Costo_Total] [decimal](18, 6) NULL,
[Padre] [Varchar] (20) NULL
)


Declare @linea int = 1;

--ACG--if  OBJECT_ID('Planos_Symphony.dbo.BomGlobal') is not null
if  OBJECT_ID('tempdb..#TBomGlobal') is not null
Begin
--ACG--	Delete Planos_Symphony.dbo.BomGlobal
Delete #TBomGlobal
End;

--ACG--if  OBJECT_ID('Planos_Symphony.dbo.BomNew') is not null
if OBJECT_ID('tempdb..#TBomNew') is not null
Begin
--ACG--	Delete Planos_Symphony.dbo.BomNew
Delete #TBomNew
End;

Declare @Code Varchar(20) 

Declare @BodAlt Varchar(20) = 'MP-01'
Declare @LPrecio Varchar(10) = 10

Declare @Bodega_ Varchar(20)
Declare @Father_ Varchar(20)
Declare @Codigo_ Varchar(20)
Declare @Cantidad_ Decimal(18,6)
Declare @Desc	Varchar(100)
Declare @CostoU_ Decimal(18,6)

Declare @Bodega2_ Varchar(20)
Declare @Father2_ Varchar(20)
Declare @Codigo2_ Varchar(20)
Declare @Cantidad2_ Decimal(18,6)

Declare @Bodega3_ Varchar(20)
Declare @Father3_ Varchar(20)
Declare @Codigo3_ Varchar(20)
Declare @Cantidad3_ Decimal(18,6)

Declare @CostoMp_ Decimal(18,6)
Declare @CostoMo_ Decimal(18,6)
Declare @CostoCif_ Decimal(18,6)

Declare @TCostoMp_ Decimal(18,6)
Declare @TCostoMo_ Decimal(18,6)
Declare @TCostoCif_ Decimal(18,6)

Set @TCostoMp_ = 0
Set @TCostoMo_ = 0
Set @TCostoCif_ = 0

Declare MyCursorGlobal Cursor For
Select t0.ItemCode 
From OITM t0 
Inner Join (Select t0.Father
			From ITT1 t0
			Group By t0.Father) t1 On t0.ItemCode = t1.Father
Where 
--t0.ItemCode >= @Code1 And t0.ItemCode <= @Code2 And 
T0.validFor='Y'

Open MyCursorGlobal
Fetch Next from MyCursorGlobal
Into @Code

If @@FETCH_STATUS = 0
Begin
		While @@FETCH_STATUS = 0
	    Begin

			--if  OBJECT_ID('Planos_Symphony.dbo.BomNew') is not null
			if OBJECT_ID('tempdb..#TBomNew') is not null
			Begin
			--Delete Planos_Symphony.dbo.BomNew
			Delete #TBomNew
			End;

-- /------------------------------------------------------------------------------------------------------------------------------------------------ / --

			Declare MyCursor Cursor For
			Select t0.Warehouse, t0.Father, t0.Code, Quantity From ITT1 t0 Where t0.Father = @Code

			Open MyCursor
			Fetch Next from MyCursor
			Into @Bodega_, @Father_, @Codigo_, @Cantidad_


			Set @CostoU_ = 0
			Select @Desc = t0.ItemName From OITM t0 Where t0.ItemCode = @Code
			--ACG--Insert Into Planos_Symphony.dbo.BomNew (Linea, Codigo, descripcion, nivel, cantidad, costo_unitario) Values (@linea, @Code, @Desc, 1, 1, @CostoU_)
			Insert Into #TBomNew (Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, Padre) Values (@linea, @Code, @Desc, 1, 1, @CostoU_,@Father_)
			Set @linea = @linea + 1
			
			If @@FETCH_STATUS = 0 
			Begin
					While @@FETCH_STATUS = 0
					Begin

						Select @Desc = t0.ItemName From OITM t0 Where t0.ItemCode = @Codigo_		 
						Select @CostoU_ = t0.AvgPrice From OITW t0 Where t0.ItemCode = @Codigo_ And t0.WhsCode = @Bodega_ 

						If (@CostoU_ = 0)
						   Select @CostoU_ = t0.AvgPrice From OITW t0 Where t0.ItemCode = @Codigo_ And t0.WhsCode = @BodAlt

						If (@CostoU_ = 0)
						   Select @CostoU_ = t1.Price
						   From OPLN t0
						   Inner Join ITM1 t1 On t0.ListNum = t1.PriceList
						   Where t0.ListNum = @LPrecio And t1.ItemCode = @Codigo_

						Select @CostoMp_ = t0.AvgPrice * @Cantidad_
						From OITW t0 
						Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
						Where t0.ItemCode = @Codigo_ And t0.WhsCode = @Bodega_  And (t1.QryGroup39 = 'N' And t1.QryGroup39 = 'N')

						If (IsNull(@CostoMp_,0) = 0)
						   Select @CostoMp_ = (t0.AvgPrice * @Cantidad_) From OITM t0 Where t0.ItemCode = @Codigo_ And t0.EvalSystem = 'S'

						Select @CostoMo_ = t0.AvgPrice * @Cantidad_
						From OITW t0 
						Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
						Where t0.ItemCode = @Codigo_ And t0.WhsCode = @Bodega_  And (t1.QryGroup39 = 'Y')

						Select @CostoCif_ = t0.AvgPrice * @Cantidad_
						From OITW t0 
						Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
						Where t0.ItemCode = @Codigo_ And t0.WhsCode = @Bodega_  And (t1.QryGroup40 = 'Y')

						--Insert Into Planos_Symphony.dbo.BomNew (Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total) 
						--                                       Values (@Codigo_, @Desc, 2, @Cantidad_, @CostoU_, @CostoMp_, @CostoMo_, @CostoCif_, ISNULL(@CostoMp_,0)+ISNULL(@CostoMo_,0)+ISNULL(@CostoCif_,0))

			
						--Analisis de Niveles 3 y 4
						Declare MyCursorDet Cursor For
						Select t0.Warehouse, t0.Father, t0.Code, Quantity From ITT1 t0 Where t0.Father = @Codigo_

						Open MyCursorDet
						Fetch Next from MyCursorDet
						Into @Bodega2_, @Father2_, @Codigo2_, @Cantidad2_
						
					
						--Nivel 3
						If @@FETCH_STATUS = 0
						Begin

								--Encabezado Nivel 2
								--ACG--Insert Into Planos_Symphony.dbo.BomNew (Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total) 
								--ACG--								Values (@linea, @Codigo_, @Desc, 2, @Cantidad_, 0, 0, 0, 0, 0)
								Insert Into #TBomNew(Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total,Padre) ------- 
																Values (@linea, @Codigo_, @Desc, 2, @Cantidad_, 0, 0, 0, 0, 0,@Father_)  -------
								
								Set @linea = @linea + 1
								

								While @@FETCH_STATUS = 0
								Begin	
					   
									Select @Desc = t0.ItemName From OITM t0 Where t0.ItemCode = @Codigo2_		 
									Select @CostoU_ = t0.AvgPrice From OITW t0 Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @Bodega2_ 

									If (@CostoU_ = 0)
									   Select @CostoU_ = t0.AvgPrice From OITW t0 Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @BodAlt

									If (@CostoU_ = 0)
									   Select @CostoU_ = t1.Price
									   From OPLN t0
									   Inner Join ITM1 t1 On t0.ListNum = t1.PriceList
									   Where t0.ListNum = @LPrecio And t1.ItemCode = @Codigo2_


									Select @CostoMp_ = (t0.AvgPrice * @Cantidad2_ * @Cantidad_)
									From OITW t0 
									Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
									Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @Bodega2_  And (t1.QryGroup39 = 'N' And t1.QryGroup39 = 'N')

									If (IsNull(@CostoMp_,0) = 0)
									   Select @CostoMp_ = (t0.AvgPrice * @Cantidad2_) From OITM t0 Where t0.ItemCode = @Codigo2_ And t0.EvalSystem = 'S'
									
									Select @CostoMo_ = t0.AvgPrice * @Cantidad2_
									From OITW t0 
									Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
									Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @Bodega2_  And (t1.QryGroup39 = 'Y')

									Select @CostoCif_ = t0.AvgPrice * @Cantidad2_
									From OITW t0 
									Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
									Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @Bodega2_  And (t1.QryGroup40 = 'Y')


									--Insert Into Planos_Symphony.dbo.BomNew (Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total) 
									--										Values (@Codigo2_, @Desc, 3, @Cantidad2_, @CostoU_, @CostoMp_, @CostoMo_, @CostoCif_, ISNULL(@CostoMp_,0)+ISNULL(@CostoMo_,0)+ISNULL(@CostoCif_,0))

									--Nivel 4
									Declare MyCursorDet4 Cursor For
									Select t0.Warehouse, t0.Father, t0.Code, Quantity From ITT1 t0 Where t0.Father = @Codigo2_

									Open MyCursorDet4
									Fetch Next from MyCursorDet4
									Into @Bodega3_, @Father3_, @Codigo3_, @Cantidad3_

										If @@FETCH_STATUS = 0
										Begin
											--NIVEL 3	
											--ACG--Insert Into Planos_Symphony.dbo.BomNew (Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total) 
											--ACG--										Values (@Linea, @Codigo2_, @Desc, 3, @Cantidad2_ * @Cantidad_, 0, 0, 0, 0, 0)
											Insert Into #TBomNew(Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total,Padre) -------
																					Values (@Linea, @Codigo2_, @Desc, 3, @Cantidad2_ * @Cantidad_, 0, 0, 0, 0, 0,@Father_) ------- @Father2_
											Set @linea = @linea + 1
							    
												While @@FETCH_STATUS = 0
												Begin

													Select @Desc = t0.ItemName From OITM t0 Where t0.ItemCode = @Codigo3_		 
													Select @CostoU_ = t0.AvgPrice From OITW t0 Where t0.ItemCode = @Codigo3_ And t0.WhsCode = @Bodega3_ 

													If (@CostoU_ = 0)
													   Select @CostoU_ = t0.AvgPrice From OITW t0 Where t0.ItemCode = @Codigo3_ And t0.WhsCode = @BodAlt

													If (@CostoU_ = 0)
													   Select @CostoU_ = t1.Price
													   From OPLN t0
													   Inner Join ITM1 t1 On t0.ListNum = t1.PriceList
													   Where t0.ListNum = @LPrecio And t1.ItemCode = @Codigo3_

													Select @CostoMp_ = @CostoU_ * @Cantidad3_ * @Cantidad2_ * @Cantidad_  --UC
													
													If (IsNull(@CostoMp_,0) = 0)
													Select @CostoMp_ = (t0.AvgPrice * @Cantidad3_ * @Cantidad2_ * @Cantidad_) --UC
													From OITW t0 
													Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
													Where t0.ItemCode = @Codigo3_ And t0.WhsCode = @Bodega3_  And (t1.QryGroup39 = 'N' And t1.QryGroup39 = 'N')

													If (IsNull(@CostoMp_,0) = 0)
													   Select @CostoMp_ = (t0.AvgPrice * @Cantidad3_* @Cantidad_) From OITM t0 Where t0.ItemCode = @Codigo3_ And t0.EvalSystem = 'S' --UC

													Select @CostoMo_ = t0.AvgPrice * @Cantidad3_ * @Cantidad2_* @Cantidad_ --UC
													From OITW t0 
													Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
													Where t0.ItemCode = @Codigo3_ And t0.WhsCode = @Bodega3_  And (t1.QryGroup39 = 'Y')

													Select @CostoCif_ = t0.AvgPrice * @Cantidad3_ * @Cantidad2_* @Cantidad_ --UC
													From OITW t0 
													Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
													Where t0.ItemCode = @Codigo3_ And t0.WhsCode = @Bodega3_  And (t1.QryGroup40 = 'Y')


													--Incluido Aqui
													If IsNull((Select t0.QryGroup39 From OITM t0 Where t0.ItemCode = @Codigo3_),'') = 'Y'
													Begin
														--Set @TCostoMo_ = @TCostoMo_ + @CostoMo_
														Set @CostoCif_ = 0
														Set @CostoMp_ = 0
													End
												    
													If  IsNull((Select t0.QryGroup40 From OITM t0 Where t0.ItemCode = @Codigo3_),'')= 'Y'
													Begin
														--Set @TCostoCif_ = @TCostoCif_ + @CostoCif_
														Set @CostoMo_ = 0
														Set @CostoMp_ = 0
													End

													If IsNull((Select t0.QryGroup39 From OITM t0 Where t0.ItemCode = @Codigo3_),'') = 'N' And 
														IsNull((Select t0.QryGroup40 From OITM t0 Where t0.ItemCode = @Codigo3_),'') = 'N'
													Begin
														Set @CostoCif_ = 0
														Set @CostoMo_ = 0
													End							
													--Hasta Aqui


													--ACG--Insert Into Planos_Symphony.dbo.BomNew (Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total) 
													--ACG--										Values (@Linea, @Codigo3_, @Desc, 4, @Cantidad3_*@Cantidad2_*@Cantidad_, @CostoU_, @CostoMp_, @CostoMo_, @CostoCif_, ISNULL(@CostoMp_,0)+ISNULL(@CostoMo_,0)+ISNULL(@CostoCif_,0))
													Insert Into #TBomNew (Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total,Padre)  -------
																							Values (@Linea, @Codigo3_, @Desc, 4, @Cantidad3_*@Cantidad2_*@Cantidad_, @CostoU_, @CostoMp_, @CostoMo_, @CostoCif_, ISNULL(@CostoMp_,0)+ISNULL(@CostoMo_,0)+ISNULL(@CostoCif_,0),@Father_) -------@Father3_
													Set @linea = @linea + 1

													Set @TCostoMp_ = @TCostoMp_ + @CostoMp_
													Set @TCostoMo_ = @TCostoMo_ + @CostoMo_
													Set @TCostoCif_ = @TCostoCif_ + @CostoCif_
										 
													Fetch Next from MyCursorDet4
													Into @Bodega3_, @Father3_, @Codigo3_, @Cantidad3_
												End
										End
										Else
											Begin
												--Inclui aqui lo nuevo
													Select @Desc = t0.ItemName From OITM t0 Where t0.ItemCode = @Codigo2_		 
													Select @CostoU_ = t0.AvgPrice From OITW t0 Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @Bodega3_ 

													If (@CostoU_ = 0)
													Begin
													   Select @CostoU_ = t0.AvgPrice From OITW t0 Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @BodAlt
													End

													If (@CostoU_ = 0)
													Begin
													   Select @CostoU_ = t1.Price
													   From OPLN t0
													   Inner Join ITM1 t1 On t0.ListNum = t1.PriceList
													   Where t0.ListNum = @LPrecio And t1.ItemCode = @Codigo2_
												    End
												    
												    Select @CostoMp_ = @CostoU_ *  @Cantidad2_ * @Cantidad_
												    If (IsNull(@CostoMp_,0) = 0)
												    Begin
														Select @CostoMp_ = (t0.AvgPrice * @Cantidad2_ * @Cantidad_)
														From OITW t0 
														Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
														Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @Bodega2_  And (t1.QryGroup39 = 'N' And t1.QryGroup39 = 'N')
												    End
												    
														If (IsNull(@CostoMp_,0) = 0)
														   Select @CostoMp_ = (t0.AvgPrice * @Cantidad2_) From OITM t0 Where t0.ItemCode = @Codigo2_ And t0.EvalSystem = 'S'
												
														Select @CostoMo_ = t0.AvgPrice * @Cantidad2_ * @Cantidad_
														From OITW t0 
														Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
														Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @Bodega2_  And (t1.QryGroup39 = 'Y')


														Select @CostoCif_ = t0.AvgPrice * @Cantidad2_ * @Cantidad_
														From OITW t0 
														Inner Join OITM t1 On t0.ItemCode = t1.ItemCode
														Where t0.ItemCode = @Codigo2_ And t0.WhsCode = @Bodega2_  And (t1.QryGroup40 = 'Y')
												
												
												
												
												--Hasta Aqui
											
												If IsNull((Select t0.QryGroup39 From OITM t0 Where t0.ItemCode = @Codigo2_),'') = 'Y'
												Begin
													--Set @TCostoMo_ = @TCostoMo_ + @CostoMo_
													Set @CostoCif_ = 0
													Set @CostoMp_ = 0
												End
												
												If IsNull((Select t0.QryGroup40 From OITM t0 Where t0.ItemCode = @Codigo2_),'') = 'Y'
												Begin
													--Set @TCostoCif_ = @TCostoCif_ + @CostoCif_
													Set @CostoMo_ = 0
													Set @CostoMp_ = 0
												End
												
												If IsNull((Select t0.QryGroup39 From OITM t0 Where t0.ItemCode = @Codigo2_),'') = 'N' And 
													IsNull((Select t0.QryGroup40 From OITM t0 Where t0.ItemCode = @Codigo2_),'') = 'N'
												Begin
													Set @CostoCif_ = 0
													Set @CostoMo_ = 0
												End

												Set @TCostoMp_ = @TCostoMp_ + @CostoMp_
												Set @TCostoMo_ = @TCostoMo_ + @CostoMo_
												Set @TCostoCif_ = @TCostoCif_ + @CostoCif_
												----
												--NIVEL 3
												--ACG--Insert Into Planos_Symphony.dbo.BomNew (Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total) 
												--ACG--										Values (@Linea, @Codigo2_, @Desc, 3, @Cantidad2_* @Cantidad_, @CostoU_, @CostoMp_, @CostoMo_, @CostoCif_, ISNULL(@CostoMp_,0)+ISNULL(@CostoMo_,0)+ISNULL(@CostoCif_,0))
												Insert Into #TBomNew (Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total,Padre) -------
																						Values (@Linea, @Codigo2_, @Desc, 3, @Cantidad2_* @Cantidad_, @CostoU_, @CostoMp_, @CostoMo_, @CostoCif_, ISNULL(@CostoMp_,0)+ISNULL(@CostoMo_,0)+ISNULL(@CostoCif_,0),@Father_) -------@Father2_
												
												Set @linea = @linea + 1										
																						
											End

										close MyCursorDet4
										deallocate MyCursorDet4

									Fetch Next from MyCursorDet
									Into @Bodega2_, @Father2_, @Codigo2_, @Cantidad2_
								End
						End
						Else
							Begin
								If IsNull((Select t0.QryGroup39 From OITM t0 Where t0.ItemCode = @Codigo_),'') = 'Y'
								Begin
									Set @TCostoMo_ = @TCostoMo_ + @CostoMo_
									Set @CostoCif_ = 0
									Set @CostoMp_ = 0
							    End
							    
								If  IsNull((Select t0.QryGroup40 From OITM t0 Where t0.ItemCode = @Codigo_),'')= 'Y'
								Begin
									Set @TCostoCif_ = @TCostoCif_ + @CostoCif_
									Set @CostoMo_ = 0
									Set @CostoMp_ = 0
								End

								If IsNull((Select t0.QryGroup39 From OITM t0 Where t0.ItemCode = @Codigo_),'') = 'N' And 
									IsNull((Select t0.QryGroup40 From OITM t0 Where t0.ItemCode = @Codigo_),'') = 'N'
								Begin
									Set @CostoCif_ = 0
									Set @CostoMo_ = 0
								End							
									
								Set @TCostoMp_ = @TCostoMp_ + @CostoMp_

								--ACG--Insert Into Planos_Symphony.dbo.BomNew (Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total) 
								--ACG--										Values (@Linea, @Codigo_, @Desc, 2, @Cantidad_, @CostoU_, @CostoMp_, @CostoMo_, @CostoCif_, ISNULL(@CostoMp_,0)+ISNULL(@CostoMo_,0)+ISNULL(@CostoCif_,0))
								Insert Into #TBomNew(Linea, Codigo, descripcion, nivel, cantidad, costo_unitario, costo_mp, costo_mo, costo_cif, costo_total,Padre) -------
																	Values (@Linea, @Codigo_, @Desc, 2, @Cantidad_, @CostoU_, @CostoMp_, @CostoMo_, @CostoCif_, ISNULL(@CostoMp_,0)+ISNULL(@CostoMo_,0)+ISNULL(@CostoCif_,0),@Father_) -------
								
								Set @linea = @linea + 1										
																		
							End

						close MyCursorDet
						deallocate MyCursorDet

		   
						Fetch Next from MyCursor
						Into @Bodega_, @Father_, @Codigo_, @Cantidad_
					End
			End

			--ACG--Update Planos_Symphony.dbo.BomNew Set costo_mp = @TCostoMp_ Where codigo  = @Code And nivel = 1
			--ACG--Update Planos_Symphony.dbo.BomNew Set costo_mo = @TCostoMo_ Where codigo  = @Code And nivel = 1
			--ACG--Update Planos_Symphony.dbo.BomNew Set costo_cif = @TCostoCif_ Where codigo  = @Code And nivel = 1
			--ACG--Update Planos_Symphony.dbo.BomNew Set costo_total = IsNull(@TCostoMp_,0) + IsNull(@TCostoMo_,0) + IsNull(@TCostoCif_,0) Where codigo = @Code And nivel = 1
			
			Update #TBomNew Set costo_mp = @TCostoMp_ Where codigo  = @Code And nivel = 1
			Update #TBomNew Set costo_mo = @TCostoMo_ Where codigo  = @Code And nivel = 1
			Update #TBomNew Set costo_cif = @TCostoCif_ Where codigo  = @Code And nivel = 1
			Update #TBomNew Set costo_total = IsNull(@TCostoMp_,0) + IsNull(@TCostoMo_,0) + IsNull(@TCostoCif_,0) Where codigo = @Code And nivel = 1
			Set @TCostoCif_ = 0
			Set @TCostoMo_ = 0
			Set @TCostoMp_ = 0
			
			close MyCursor
			deallocate MyCursor

			--ACG--Insert Into Planos_Symphony.dbo.BomGlobal
			--ACG--Select * From Planos_Symphony.dbo.BomNew 
			Insert Into #TBomGlobal Select * From #TBomNew



-- /------------------------------------------------------------------------------------------------------------------------------------------------ / --
			Fetch Next from MyCursorGlobal
			Into @Code
		End
End

close MyCursorGlobal
deallocate MyCursorGlobal

Select t0.linea, t0.Codigo, t0.Descripcion, t1.SalUnitMsr UnidadMedida, t0.Nivel, t0.Cantidad, t0.Costo_Unitario, t0.Costo_Mp, t0.Costo_Mo, t0.Costo_Cif, t0.Costo_Total, Padre
--ACG--From Planos_Symphony.dbo.BomGlobal t0
FROM #TBomGlobal t0
Left Join OITM t1 On t0.Codigo collate SQL_Latin1_General_CP1_CI_AS = t1.ItemCode collate SQL_Latin1_General_CP1_CI_AS
Order By t0.linea
Drop Table #TBomGlobal
Drop Table #TBomNew